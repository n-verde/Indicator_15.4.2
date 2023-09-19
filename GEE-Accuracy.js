/*=============================================================================

==== 15.4.2 =====
Natalia Verde, AUTH, 2023 

BRIEF DESCRIPTION:
This GEE script performs accuracy assessment to a classified image, based on given reference points


*/

//====================================================================================

//===============PARAMETER SETTINGS===================================================


// ---------- SET CLASSIFIED IMAGE ----------
var cl = ee.Image('users/n-verde/PhD_1542/1542_CLC_prediciton');

// ---------- SET TEST POINTS
// var testPoints = ee.FeatureCollection('users/n-verde/PhD_1542/Points_LIFE_TEST_1000');
// var testPoints = ee.FeatureCollection('users/n-verde/PhD_1542/Points_LIFE_TEST_1500');
var testPoints = ee.FeatureCollection('users/n-verde/PhD_1542/Points_LIFE_TEST_2418');

// ---------- SET CLASS PROPERTY ATTRIBUTE
var prop = 'cl_IPCC_in';

// ---------- SET NUMBER OF CLASSES
var numCl = 6;

// ---------- SET FUNCTION FOR ACCURACY ASSESSMENT ----------
var AC = require('users/n-verde/PhD_1542:Accuracy_function');

// ---------- OTHER SETTINGS ----------
//(it's not recomended to change these values)
var scale = 20;
var Kapos = ee.Image('users/n-verde/PhD_1542/Kapos_K1_GR_binary');

//====================================================================================


var classified = cl.select("pred").rename("classification");

// ---------- ACCURACY
var accuracyOutputs = AC.accuracyFun(classified, testPoints, prop, scale, numCl);

var EM = accuracyOutputs[0]; print("Error Matrix:", EM);
var OA = accuracyOutputs[1]; print("OA:", OA);
var PA = accuracyOutputs[2]; print("PA (Omission accuracy):", PA);
var UA = accuracyOutputs[3]; print("UA (Commission Accuracy):", UA);
var ICSI = accuracyOutputs[5]; print("ICSI:", ICSI);

//====================================================================================

// __________________ GT _______________________________

var train = ee.Image('users/n-verde/PhD_1542/NEW_CLC2018_GR_4326_IPCC_one-hot_TRAIN_14perc');
var val = ee.Image('users/n-verde/PhD_1542/NEW_CLC2018_GR_4326_IPCC_one-hot_VAL_14perc');
var test = ee.Image('users/n-verde/PhD_1542/NEW_LIFE_4326_IPCC_one-hot_TEST_30perc');

var sld_intervals_GT =
'<RasterSymbolizer>' +
  ' <ColorMap  type="intervals" extended="false" >' +
      '<ColorMapEntry color="#000000" quantity="0" label="None"/>' + // ok
      '<ColorMapEntry color="#00A600" quantity="0.166" label="Forest"/>' + // ok
      '<ColorMapEntry color="#A6FF80" quantity="0.334" label="Grassland"/>' + // ok
      '<ColorMapEntry color="#FFE64D" quantity="0.500" label="Cropland"/>' + // ok
      '<ColorMapEntry color="#A6A6E6" quantity="0.667" label="Wetland"/>' + // ok
      '<ColorMapEntry color="#FF0000" quantity="0.834" label="Settlement"/>' + // ok
      '<ColorMapEntry color="#CCCCCC" quantity="1" label="Other"/>' + // ok
  '</ColorMap>' +
'</RasterSymbolizer>';

Map.addLayer(train.sldStyle(sld_intervals_GT), {}, 'train', true)
Map.addLayer(val.sldStyle(sld_intervals_GT), {}, 'val', true)
Map.addLayer(test.sldStyle(sld_intervals_GT), {}, 'test', true)

//====================================================================================


var sld_intervals_pred =
'<RasterSymbolizer>' +
  ' <ColorMap  type="values" extended="false" >' +
      // '<ColorMapEntry color="#000000" quantity="0" label="None"/>' + // ok
      '<ColorMapEntry color="#00A600" quantity="0" label="Forest"/>' + // ok
      '<ColorMapEntry color="#A6FF80" quantity="1" label="Grassland"/>' + // ok
      '<ColorMapEntry color="#FFE64D" quantity="2" label="Cropland"/>' + // ok
      '<ColorMapEntry color="#A6A6E6" quantity="3" label="Wetland"/>' + // ok
      '<ColorMapEntry color="#FF0000" quantity="4" label="Settlement"/>' + // ok
      '<ColorMapEntry color="#CCCCCC" quantity="5" label="Other"/>' + // ok
  '</ColorMap>' +
'</RasterSymbolizer>';

var sld_intervals_pred_GREEN =
'<RasterSymbolizer>' +
  ' <ColorMap  type="values" extended="false" >' +
      // '<ColorMapEntry color="#000000" quantity="0" label="None"/>' + // ok
      '<ColorMapEntry color="#00A600" quantity="0" label="Forest"/>' + // ok
      '<ColorMapEntry color="#A6FF80" quantity="1" label="Grassland"/>' + // ok
      '<ColorMapEntry color="#FFE64D" quantity="2" label="Cropland"/>' + // ok
      '<ColorMapEntry color="#A6A6E6" quantity="3" label="Wetland"/>' + // ok
      // '<ColorMapEntry color="#FF0000" quantity="4" label="Settlement"/>' + // ok
      // '<ColorMapEntry color="#CCCCCC" quantity="5" label="Other"/>' + // ok
  '</ColorMap>' +
'</RasterSymbolizer>';

var mountain_green = cl.mask(cl.lte(3)).updateMask(Kapos);

Map.addLayer(cl.sldStyle(sld_intervals_pred), {}, 'prediction', false)
Map.addLayer(cl.sldStyle(sld_intervals_pred).mask(Kapos), {}, 'prediction_mountains', false)
Map.addLayer(mountain_green.sldStyle(sld_intervals_pred_GREEN), {}, 'prediction_GREEN')
Map.addLayer(testPoints, {}, 'test points')





