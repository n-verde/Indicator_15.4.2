# SDG Indicator 15.4.2

## General Information
This repository contains the code developed for mapping land cover at a national scale, using Sentinel-2 imagery and weak labels from CORINE land cover data, for aiding the calculation of SDG indicator 15.4.2.
The deep model used for training is the Fine-Grained UNET by [Stoian et. al, 2019](https://www.mdpi.com/2072-4292/11/17/1986).

![alt text](https://github.com/n-verde/Indicator_15.4.2/blob/main/images/RESULTS_greece_mountain.png?raw=true)
*Green coverage as derived from the classification, for the mountainous areas of Greece*

![alt text](https://github.com/n-verde/Indicator_15.4.2/blob/main/images/RESULTS_AOIs_best_CLC.png?raw=true)
*Classification result (c,f,i), compared with the weak labes from the CLC data (b,e,h) and the Google Earth image of each case (a,d,g)*

![alt text](https://github.com/n-verde/Indicator_15.4.2/blob/main/images/RESULTS_AOIs_best.png?raw=true)
*Classification result (c,f,i), compared to the ESA CCI LC product (b,e,h) and the Google Earth image of each case (a,d,g)*

## Further reading - Citations
Verde N. *Calculation and mapping of sustainable development goal indicators, using open-source earth observation data and cloud computing services*. Dissertation. Aristotle University of Thessaloniki; 2023. http://dx.doi.org/10.12681/eadd/56272 

Verde N, Patias P, Mallinis G. *Mountain Green Cover Index Calculation at a National Scale Using Weak and Sparse Data*. InIGARSS 2024-2024 IEEE International Geoscience and Remote Sensing Symposium 2024 Jul 7 (pp. 397-402). IEEE. https://doi.org/10.1109/IGARSS53475.2024.10642510 


