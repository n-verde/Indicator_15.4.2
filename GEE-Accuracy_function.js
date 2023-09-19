/*=============================================================================

==== 15.4.2 =====
Natalia Verde, AUTH, 2023 

BRIEF DESCRIPTION:
This GEE script has a function for performing accuracy assessment to a classified image

*/


/////////////////////////////////////////////////////////////
// This function calculates accuracy metrics derrived from an error matrix, for a classified image
/* "classifiedImage" is the classified image with classes as numbers
   "samples" are the test samples in a ee.FeatureCollection form
   "prop" is the attribute depicting the correct class in the samples FC
   "scale" is the scale in m of the classifiedImage
*/
function accuracyFun(classifiedImage, samples, prop, scale, numberOfClasses) {
  // sample the classified image, to obtain the class information for validation points
  // validation points must already contain the correct class information
  var TestSamples = ee.Image(classifiedImage).sampleRegions({
    collection: samples,
    properties: [prop],
    scale: scale,
    tileScale: 16, //5,
    geometries: true
    });
  
  var errorMatrix = TestSamples.errorMatrix(prop, 'classification');
  // print('Error Matrix:', errorMatrix)
  
  var OA = errorMatrix.accuracy();
  // print('OA:', OA)
  var PA = (errorMatrix.producersAccuracy())//.slice({axis: 0, start: 1, end: 7, step: 1});
  // print('PA (Omission accuracy):', PA)
  var UA = (errorMatrix.consumersAccuracy())//.slice({axis: 1, start: 1, end: 7, step: 1});
  // print('UA (Commission Accuracy):', UA)
  var Kappa = errorMatrix.kappa();
  // print('Kappa:', Kappa)
  
  // Individual Classification Success Index (ICSI)
  var onesList = ee.List.repeat([ee.Number(1)], numberOfClasses);
  var onesArray = ee.Array(onesList);
  var ICSI = (UA.transpose()).add(PA).subtract(onesArray);
  // print('ICSI:', ICSI)
  
  return [errorMatrix, OA, PA, UA, Kappa, ICSI];

}

exports.accuracyFun = accuracyFun;
