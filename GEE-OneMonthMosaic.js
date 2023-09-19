/*=============================================================================

==== 15.4.2 =====
Natalia Verde & Vangelis Fotakidis AUTH, 2023 

BRIEF DESCRIPTION:
This GEE script creates montlhy mosaics from Sentinel-2 imagery for Greece.

*/


var GR_bounds = ee.Image('users/n-verde/PhD_1542/GR_2km_buff_4326');

// Configuration -----------------------------------------------

var min_year = 2018; 
var min_month = 10;
var max_month = 11;
var min_date = "2018-10-01";
var max_date = "2018-12-01";
var intermediateDate = "2018-11-01"; // only for naming the exported bands

var allBands = ['B2','B3','B4','B5','B6','B7','B8','B8A','B11','B12'];

// var roi = geometry;
var roi = GR_bounds.geometry();

var exp = false; // whether to export also in Drive or only Assets
var descr = 'MedianMonths10-11_GR_2018'; // output image description

// ----------------------------------------------------------

// START SETUP

/////////////////////////////////////////////////////////////
//These functions correct the BRDF effect of a S2 image, surface reflectance product
//Source: https://github.com/ndminhhus/geeguide/blob/master/04.topo_correction.md
//(Minh et al., 2020), https://doi.org/10.3390/rs12020281
//Adapted from: Poortinga et al.,2018 https://doi.org/10.3390/rs1107083

//Global variables
var PI = ee.Number(3.14159265359);
var MAX_SATELLITE_ZENITH = 7.5;
var MAX_DISTANCE = 1000000;
var UPPER_LEFT = 0;
var LOWER_LEFT = 1;
var LOWER_RIGHT = 2;
var UPPER_RIGHT = 3;
var bandIn = allBands;
var bandOut = ['blue','green','red','re1','re2','re3','nir','re4','swir1','swir2'];

function applyBRDF_S2(image){
    
    image = image.select(bandIn,bandOut);
    var date = image.date();
    var footprint = ee.List(image.geometry().bounds().bounds().coordinates().get(0));
    var angles =  getsunAngles(date, footprint);
    var sunAz = angles[0];
    var sunZen = angles[1];
  
    var viewAz = azimuth(footprint);
    var viewZen = zenith(footprint);
  
  
    var kval = _kvol(sunAz, sunZen, viewAz, viewZen);
    var kvol = kval[0];
    var kvol0 = kval[1];
    var result = _applyS2(image, kvol.multiply(PI), kvol0.multiply(PI));
  
    return result.select(bandOut,bandIn);
}
function getsunAngles(date, footprint){
  var jdp = date.getFraction('year');
  var seconds_in_hour = 3600;
  var  hourGMT = ee.Number(date.getRelative('second', 'day')).divide(seconds_in_hour);
    
  var latRad = ee.Image.pixelLonLat().select('latitude').multiply(PI.divide(180));
  var longDeg = ee.Image.pixelLonLat().select('longitude');
    
  // Julian day proportion in radians
  var jdpr = jdp.multiply(PI).multiply(2);
    
  var a = ee.List([0.000075, 0.001868, 0.032077, 0.014615, 0.040849]);
  var meanSolarTime = longDeg.divide(15.0).add(ee.Number(hourGMT));
  var localSolarDiff1 = value(a, 0)
          .add(value(a, 1).multiply(jdpr.cos())) 
          .subtract(value(a, 2).multiply(jdpr.sin())) 
          .subtract(value(a, 3).multiply(jdpr.multiply(2).cos())) 
          .subtract(value(a, 4).multiply(jdpr.multiply(2).sin()));

  var localSolarDiff2 = localSolarDiff1.multiply(12 * 60);
  
  var localSolarDiff = localSolarDiff2.divide(PI);
  var trueSolarTime = meanSolarTime 
          .add(localSolarDiff.divide(60)) 
          .subtract(12.0);
    
  // Hour as an angle;
  var ah = trueSolarTime.multiply(ee.Number(MAX_SATELLITE_ZENITH * 2).multiply(PI.divide(180))) ;   
  var b = ee.List([0.006918, 0.399912, 0.070257, 0.006758, 0.000907, 0.002697, 0.001480]);
  var delta = value(b, 0) 
        .subtract(value(b, 1).multiply(jdpr.cos())) 
        .add(value(b, 2).multiply(jdpr.sin())) 
        .subtract(value(b, 3).multiply(jdpr.multiply(2).cos())) 
        .add(value(b, 4).multiply(jdpr.multiply(2).sin())) 
        .subtract(value(b, 5).multiply(jdpr.multiply(3).cos())) 
        .add(value(b, 6).multiply(jdpr.multiply(3).sin()));

  var cosSunZen = latRad.sin().multiply(delta.sin()) 
        .add(latRad.cos().multiply(ah.cos()).multiply(delta.cos()));
  var sunZen = cosSunZen.acos();

  // sun azimuth from south, turning west
  var sinSunAzSW = ah.sin().multiply(delta.cos()).divide(sunZen.sin());
  sinSunAzSW = sinSunAzSW.clamp(-1.0, 1.0);
  
  var cosSunAzSW = (latRad.cos().multiply(-1).multiply(delta.sin())
                    .add(latRad.sin().multiply(delta.cos()).multiply(ah.cos()))) 
                    .divide(sunZen.sin());
  var sunAzSW = sinSunAzSW.asin();
  
  sunAzSW = where(cosSunAzSW.lte(0), sunAzSW.multiply(-1).add(PI), sunAzSW);
  sunAzSW = where(cosSunAzSW.gt(0).and(sinSunAzSW.lte(0)), sunAzSW.add(PI.multiply(2)), sunAzSW);
  
  var sunAz = sunAzSW.add(PI);
   // # Keep within [0, 2pi] range
    sunAz = where(sunAz.gt(PI.multiply(2)), sunAz.subtract(PI.multiply(2)), sunAz);
  
  var footprint_polygon = ee.Geometry.Polygon(footprint);
  sunAz = sunAz.clip(footprint_polygon);
  sunAz = sunAz.rename(['sunAz']);
  sunZen = sunZen.clip(footprint_polygon).rename(['sunZen']);
  
  return [sunAz, sunZen];
}
function azimuth(footprint){
    function x(point){return ee.Number(ee.List(point).get(0))}
    function  y(point){return ee.Number(ee.List(point).get(1))}
    
    var upperCenter = line_from_coords(footprint, UPPER_LEFT, UPPER_RIGHT).centroid().coordinates();
    var lowerCenter = line_from_coords(footprint, LOWER_LEFT, LOWER_RIGHT).centroid().coordinates();
    var slope = ((y(lowerCenter)).subtract(y(upperCenter))).divide((x(lowerCenter)).subtract(x(upperCenter)));
    var slopePerp = ee.Number(-1).divide(slope);
    var azimuthLeft = ee.Image(PI.divide(2).subtract((slopePerp).atan()));
    return azimuthLeft.rename(['viewAz']);
  }
function zenith(footprint){
    var leftLine = line_from_coords(footprint, UPPER_LEFT, LOWER_LEFT);
    var rightLine = line_from_coords(footprint, UPPER_RIGHT, LOWER_RIGHT);
    var leftDistance = ee.FeatureCollection(leftLine).distance(MAX_DISTANCE);
    var rightDistance = ee.FeatureCollection(rightLine).distance(MAX_DISTANCE);
    var viewZenith = rightDistance.multiply(ee.Number(MAX_SATELLITE_ZENITH * 2)) 
          .divide(rightDistance.add(leftDistance)) 
          .subtract(ee.Number(MAX_SATELLITE_ZENITH)) 
          .clip(ee.Geometry.Polygon(footprint)) 
          .rename(['viewZen']);
    return viewZenith.multiply(PI.divide(180));
}
function _applyS2(image, kvol, kvol0){
      var f_iso = 0;
      var f_geo = 0;
      var f_vol = 0;
			var blue = _correct_band(image, 'blue', kvol, kvol0, f_iso=0.0774, f_geo=0.0079, f_vol=0.0372);
			var green = _correct_band(image, 'green', kvol, kvol0, f_iso=0.1306, f_geo=0.0178, f_vol=0.0580);
			var red = _correct_band(image, 'red', kvol, kvol0, f_iso=0.1690, f_geo=0.0227, f_vol=0.0574);
			var re1 = _correct_band(image, 're1', kvol, kvol0, f_iso=0.2085, f_geo=0.0256, f_vol=0.0845);
			var re2 = _correct_band(image, 're2', kvol, kvol0, f_iso=0.2316, f_geo=0.0273, f_vol=0.1003);
			var re3 = _correct_band(image, 're3', kvol, kvol0, f_iso=0.2599, f_geo=0.0294, f_vol=0.1197);
      var nir = _correct_band(image, 'nir', kvol, kvol0, f_iso=0.3093, f_geo=0.0330, f_vol=0.1535);
      var re4 = _correct_band(image, 're4', kvol, kvol0, f_iso=0.2907, f_geo=0.0410, f_vol=0.1611);
      var swir1 = _correct_band(image, 'swir1', kvol, kvol0, f_iso=0.3430, f_geo=0.0453, f_vol=0.1154);   
      var swir2 = _correct_band(image, 'swir2', kvol, kvol0, f_iso=0.2658, f_geo=0.0387, f_vol=0.0639);
			return image.select([]).addBands([blue, green, red, nir,re1,re2,re3,nir,re4,swir1, swir2]);
}
function _correct_band(image, band_name, kvol, kvol0, f_iso, f_geo, f_vol){
	//"""fiso + fvol * kvol + fgeo * kgeo"""
	var iso = ee.Image(f_iso);
	var geo = ee.Image(f_geo);
	var vol = ee.Image(f_vol);
	var pred = vol.multiply(kvol).add(geo.multiply(kvol)).add(iso).rename(['pred']);
	var pred0 = vol.multiply(kvol0).add(geo.multiply(kvol0)).add(iso).rename(['pred0']);
	var cfac = pred0.divide(pred).rename(['cfac']);
	var corr = image.select(band_name).multiply(cfac).rename([band_name]);
	return corr;
}
function _kvol(sunAz, sunZen, viewAz, viewZen){
	//"""Calculate kvol kernel.
	//From Lucht et al. 2000
	//Phase angle = cos(solar zenith) cos(view zenith) + sin(solar zenith) sin(view zenith) cos(relative azimuth)"""
			
	var relative_azimuth = sunAz.subtract(viewAz).rename(['relAz']);
	var pa1 = viewZen.cos().multiply(sunZen.cos());
	var pa2 = viewZen.sin().multiply(sunZen.sin()).multiply(relative_azimuth.cos());
	var phase_angle1 = pa1.add(pa2);
	var phase_angle = phase_angle1.acos();
	var p1 = ee.Image(PI.divide(2)).subtract(phase_angle);
	var p2 = p1.multiply(phase_angle1);
	var p3 = p2.add(phase_angle.sin());
	var p4 = sunZen.cos().add(viewZen.cos());
	var p5 = ee.Image(PI.divide(4));

	var kvol = p3.divide(p4).subtract(p5).rename(['kvol']);

	var viewZen0 = ee.Image(0);
	var pa10 = viewZen0.cos().multiply(sunZen.cos());
	var pa20 = viewZen0.sin().multiply(sunZen.sin()).multiply(relative_azimuth.cos());
	var phase_angle10 = pa10.add(pa20);
	var phase_angle0 = phase_angle10.acos();
	var p10 = ee.Image(PI.divide(2)).subtract(phase_angle0);
	var p20 = p10.multiply(phase_angle10);
	var p30 = p20.add(phase_angle0.sin());
	var p40 = sunZen.cos().add(viewZen0.cos());
	var p50 = ee.Image(PI.divide(4));

	var kvol0 = p30.divide(p40).subtract(p50).rename(['kvol0']);

	return [kvol, kvol0]}
function line_from_coords(coordinates, fromIndex, toIndex){
    return ee.Geometry.LineString(ee.List([
      coordinates.get(fromIndex),
      coordinates.get(toIndex)]));
}
function where(condition, trueValue, falseValue){
  var trueMasked = trueValue.mask(condition);
  var falseMasked = falseValue.mask(invertMask(condition));
      return trueMasked.unmask(falseMasked);
}
function invertMask(mask){
    return mask.multiply(-1).add(1);
}
function value(list,index){
    return ee.Number(list.get(index));
}


var dt = require('users/fitoprincipe/geetools:decision_tree');

function hollstein_S2_shadow(img) {
    // Ref: https://github.com/fitoprincipe/geetools-code-editor/blob/master/cloud_masks
    var difference = function (a, b) {
        var wrap = function (img) {
            return img.select(a).subtract(img.select(b));
        };
        return wrap;
    };
    var ratio = function (a, b) {
        var wrap = function (img) {
            return img.select(a).divide(img.select(b));
        };
        return wrap;
    };
    //1
    var b3 = img.select('B3').lt(3190);
    //2
    var b8a = img.select('B8A').lt(1660);
    var r511 = ratio('B5', 'B11')(img).lt(4.33);
    //3
    var b3_3 = img.select('B3').lt(5250);
    var s37 = difference('B3', 'B7')(img).lt(270);
    //4
    var r15 = ratio('B1', 'B5')(img).lt(1.184);
    var s911 = difference('B9', 'B11')(img).lt(210);
    var s911_2 = difference('B9', 'B11')(img).lt(-970);

    var dtf = dt.binary({
        1: b3,
        21: b8a,
        22: r511,
        31: s37,
        34: b3_3,
        41: s911_2,
        42: s911,
        46: r15
    }, {
        'shadow-1': [
            [1, 1],
            [21, 1],
            [31, 1],
            [41, 0]
        ],
        'shadow-2': [
            [1, 1],
            [21, 1],
            [31, 0],
            [42, 0]
        ],
        'shadow-3': [
            [1, 0],
            [22, 0],
            [34, 1],
            [46, 0]
        ],
    }, 'hollstein');
    var results = dtf(img);
    return img.updateMask(results.select("shadow").not());
}

function get_S2_SR_clean(criterion, maximum_cloud_prob, mode, masked_shadow, percentile) {
    // Helper functions
    
    function changeYear(image) {
      
      var newyear = ee.Number(min_year); // change this variable accordingly (must match startDate)
    
      var year = ee.Date(image.get('system:time_start')).get('year');
      var month = ee.Date(image.get('system:time_start')).get('month');
      var day = ee.Date(image.get('system:time_start')).get('day');
      
      var newdate = ee.Date.fromYMD(newyear,month,day);
      var newdatemillis = newdate.millis();
      
      return image.set({"system:time_start": newdatemillis, "GENERATION_TIME":newdatemillis});
      
}
    
    function maskClouds(img) {
        var clouds = ee.Image(img.get('cloud_mask')).select('probability');
        var isNotCloud = clouds.lte(maximum_cloud_prob);
        return img.addBands(clouds).updateMask(isNotCloud);
    }

    function maskEdges(s2_img) {
        return s2_img.updateMask(
            s2_img.select('B8A').mask().updateMask(s2_img.select('B9').mask()));
    }

    function maskShadow(s2_img) {
        return hollstein_S2_shadow(s2_img);
    }

    // Operations
    // -> Import
    var S2_SR = ee.ImageCollection("COPERNICUS/S2_SR");
    var S2_Clouds = ee.ImageCollection("COPERNICUS/S2_CLOUD_PROBABILITY");
    // -> Filtering operations
    S2_SR = S2_SR.filter(criterion).map(maskEdges).map(changeYear);
    S2_Clouds = S2_Clouds.filter(criterion).map(changeYear);

    // -> Join images
    var S2_SR_Cloud_Mask = ee.Join.saveFirst('cloud_mask').apply({
        primary: S2_SR,
        secondary: S2_Clouds,
        condition: ee.Filter.equals({
            leftField: 'system:index',
            rightField: 'system:index'
        })
    });

    // var s2CloudMasked = ee.ImageCollection(S2_SR_Cloud_Mask).map(maskClouds).mosaic();
    var s2CloudMasked = ee.ImageCollection(S2_SR_Cloud_Mask).map(maskClouds);
    
    if (masked_shadow) {
        s2CloudMasked = s2CloudMasked.map(maskShadow);
    }
    s2CloudMasked = s2CloudMasked.map(applyBRDF_S2);
    return s2CloudMasked;
}

function get_criterion(START_DATE, END_DATE, month_start, month_end, region) {
    return (
        ee.Filter.and(
            ee.Filter.bounds(region),
            ee.Filter.date(START_DATE, END_DATE),
            ee.Filter.calendarRange(month_start, month_end,'month')
        )
    );
}

var criterion = get_criterion(min_date, max_date, min_month, max_month, roi);
var MAX_CLOUD_PROBABILITY = 20;
var s2_collection = get_S2_SR_clean(criterion, MAX_CLOUD_PROBABILITY, true);

s2_collection = (
    s2_collection
    .sort("GENERATION_TIME")
    .map(function (image) {
        return image.clip(roi);
    })
);

// END SETUP

// var comp_p10 = s2_collection.select(allBands).reduce(ee.Reducer.percentile([10])).rename(allBands).mask(GR_bounds).clip(roi);
// var comp_p20 = s2_collection.select(allBands).reduce(ee.Reducer.percentile([20])).rename(allBands).mask(GR_bounds).clip(roi);
// var comp_p30 = s2_collection.select(allBands).reduce(ee.Reducer.percentile([30])).rename(allBands).mask(GR_bounds).clip(roi);
// var comp_p40 = s2_collection.select(allBands).reduce(ee.Reducer.percentile([40])).rename(allBands).mask(GR_bounds).clip(roi);
var comp_p50 = s2_collection.median().select(allBands).mask(GR_bounds).clip(roi);

var visualization = {
  min: 100,
  max: 2500,
  bands: ['B4', 'B3', 'B2'],
};

// print('Perc10 Image' ,comp_p10);
// print('Perc20 Image' ,comp_p20);
// print('Perc30 Image' ,comp_p30);
// print('Perc40 Image' ,comp_p40);
print('Perc50 - Median Image'  ,comp_p50);

// Map.addLayer(comp_p10, visualization, 'Perc10 Image ', false);
// Map.addLayer(comp_p20, visualization, 'Perc20 Image ', false);
// Map.addLayer(comp_p30, visualization, 'Perc30 Image ', false);
// Map.addLayer(comp_p40, visualization, 'Perc40 Image ', false);
Map.addLayer(comp_p50, {}, 'Perc50 / Median Image ');

// RENAME BANDS AND ADD DATE

function renameBands(image){
  var int = ee.Date(intermediateDate).format('MMdd');
  var new_bands = [ (int.cat('B2')),     // 1
                    (int.cat('B3')),     // 2
                    (int.cat('B4')),     // 3
                    (int.cat('B5')),     // 4
                    (int.cat('B6')),     // 5
                    (int.cat('B7')),     // 6
                    (int.cat('B8')),     // 7
                    (int.cat('B8A')),    // 8
                    (int.cat('B11')),    // 9
                    (int.cat('B12'))];   // 10
  return image.select(allBands,new_bands);
}
comp_p50 = renameBands(comp_p50);
print('rename bands:', comp_p50)

// add date property in band names
var oldNames = comp_p50.bandNames(); print(oldNames)
var newNamesClient = oldNames.map(function(x) {
                              var e = ee.String('D').cat(x); return e;
                              }); 
comp_p50 = comp_p50.select(oldNames, ee.List(newNamesClient));
print('Image for export:', comp_p50)

// EXPORT ----------

// TO ASSETS ----------

Export.image.toAsset({
  image:comp_p50.float(),
  description: descr,
  scale: 10,
  region: roi,
  maxPixels: 1e13 //max pixels allowed for download
});

// TO DRIVE ----------

if (exp === true) {

  Export.image.toDrive({
    image:comp_p50.float(),
    description: descr,
    folder: 'GEE_output',
    scale: 10,
    region: roi,
    maxPixels: 1e13 //max pixels allowed for download
  });
}
