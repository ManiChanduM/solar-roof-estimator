import { Injectable } from '@angular/core';
import { DataLayersResponse, GeoTiff, LatLng, LayerId } from '../interfaces/solar.interface';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import * as geotiff from 'geotiff';
import * as geokeysToProj4 from 'geotiff-geokeys-to-proj4';
import proj4 from 'proj4';
import { Layer } from '../interfaces/layers.interface';
import { binaryPalette, ironPalette, rainbowPalette, sunlightPalette } from './../utils/colors';
import { renderPalette, renderRGB } from './../utils/visualize';



@Injectable({
  providedIn: 'root'
})
export class DataLayersService {

  constructor(private http: HttpClient) { }

  // [START solar_api_data_layers]
  /**
   * Fetches the data layers information from the Solar API.
   *   https://developers.google.com/maps/documentation/solar/data-layers
   *
   * @param  {LatLng} location      Point of interest as latitude longitude.
   * @param  {number} radiusMeters  Radius of the data layer size in meters.
   * @param  {string} apiKey        Google Cloud API key.
   * @return {Promise<DataLayersResponse>}  Data Layers response.
   */
  getDataLayerUrls(location: LatLng, radiusMeters: number, apiKey: string) {
    const args = {
      'location.latitude': location.latitude.toFixed(5),
      'location.longitude': location.longitude.toFixed(5),
      radius_meters: radiusMeters.toString(),
      // The Solar API always returns the highest quality imagery available.
      // By default the API asks for HIGH quality, which means that HIGH quality isn't available,
      // but there is an existing MEDIUM or LOW quality, it won't return anything.
      // Here we ask for *at least* LOW quality, but if there's a higher quality available,
      // the Solar API will return us the highest quality available.
      required_quality: 'LOW',
    };
    console.log('GET dataLayers\n', args);
    const params = new URLSearchParams({ ...args, key: apiKey });
    return this.http.get(`https://solar.googleapis.com/v1/dataLayers:get?${params}`);
  }

  /**
 * Downloads the pixel values for a Data Layer URL from the Solar API.
 *
 * @param  {string} url        URL from the Data Layers response.
 * @param  {string} apiKey     Google Cloud API key.
 * @return {Promise<GeoTiff>}  Pixel values with shape and lat/lon bounds.
 */
  async downloadGeoTIFF(url: string, apiKey: string): Promise<GeoTiff> {
    console.log(`Downloading data layer: ${url}`);

    // Include your Google Cloud API key in the Data Layers URL.
    const solarUrl = url.includes('solar.googleapis.com') ? url + `&key=${apiKey}` : url;
    const response = await fetch(solarUrl);
    if (response.status != 200) {
      const error = await response.json();
      console.error(`downloadGeoTIFF failed: ${url}\n`, error);
      throw error;
    }

    // Get the GeoTIFF rasters, which are the pixel values for each band.
    const arrayBuffer = await response.arrayBuffer();
    const tiff = await geotiff.fromArrayBuffer(arrayBuffer);
    const image = await tiff.getImage();
    const rasters = await image.readRasters();

    // Reproject the bounding box into lat/lon coordinates.
    const geoKeys = image.getGeoKeys();
    const projObj = geokeysToProj4.toProj4(geoKeys);
    const projection = proj4(projObj.proj4, 'WGS84');
    const box = image.getBoundingBox();
    const sw = projection.forward({
      x: box[0] * projObj.coordinatesConversionParameters.x,
      y: box[1] * projObj.coordinatesConversionParameters.y,
    });
    const ne = projection.forward({
      x: box[2] * projObj.coordinatesConversionParameters.x,
      y: box[3] * projObj.coordinatesConversionParameters.y,
    });

    return {
      // Width and height of the data layer image in pixels.
      // Used to know the row and column since Javascript
      // stores the values as flat arrays.
      width: rasters.width,
      height: rasters.height,
      // Each raster reprents the pixel values of each band.
      // We convert them from `geotiff.TypedArray`s into plain
      // Javascript arrays to make them easier to process.
      rasters: [...Array(rasters.length).keys()].map((i) =>
        Array.from(rasters[i] as geotiff.TypedArray),
      ),
      // The bounding box as a lat/lon rectangle.
      bounds: {
        north: ne.y,
        south: sw.y,
        east: ne.x,
        west: sw.x,
      },
    };
  }
  // [END solar_api_download_geotiff]

  async getLayer(
    layerId: LayerId,
    urls: DataLayersResponse,
    googleMapsApiKey: string,
  ): Promise<Layer> {
    const get: Record<LayerId, () => Promise<Layer>> = {
      mask: async () => {
        const mask = await this.downloadGeoTIFF(urls.maskUrl, googleMapsApiKey);
        const colors = binaryPalette;
        return {
          id: layerId,
          bounds: mask.bounds,
          palette: {
            colors: colors,
            min: 'No roof',
            max: 'Roof',
          },
          render: (showRoofOnly) => [
            renderPalette({
              data: mask,
              mask: showRoofOnly ? mask : undefined,
              colors: colors,
            }),
          ],
        };
      },
      dsm: async () => {
        const [mask, data] = await Promise.all([
          this.downloadGeoTIFF(urls.maskUrl, googleMapsApiKey),
          this.downloadGeoTIFF(urls.dsmUrl, googleMapsApiKey),
        ]);
        const sortedValues = Array.from(data.rasters[0]).sort((x, y) => x - y);
        const minValue = sortedValues[0];
        const maxValue = sortedValues.slice(-1)[0];
        const colors = rainbowPalette;
        return {
          id: layerId,
          bounds: mask.bounds,
          palette: {
            colors: colors,
            min: `${minValue.toFixed(1)} m`,
            max: `${maxValue.toFixed(1)} m`,
          },
          render: (showRoofOnly) => [
            renderPalette({
              data: data,
              mask: showRoofOnly ? mask : undefined,
              colors: colors,
              min: sortedValues[0],
              max: sortedValues.slice(-1)[0],
            }),
          ],
        };
      },
      rgb: async () => {
        const [mask, data] = await Promise.all([
          this.downloadGeoTIFF(urls.maskUrl, googleMapsApiKey),
          this.downloadGeoTIFF(urls.rgbUrl, googleMapsApiKey),
        ]);
        return {
          id: layerId,
          bounds: mask.bounds,
          render: (showRoofOnly) => [renderRGB(data, showRoofOnly ? mask : undefined)],
        };
      },
      annualFlux: async () => {
        const [mask, data] = await Promise.all([
          this.downloadGeoTIFF(urls.maskUrl, googleMapsApiKey),
          this.downloadGeoTIFF(urls.annualFluxUrl, googleMapsApiKey),
        ]);
        const colors = ironPalette;
        return {
          id: layerId,
          bounds: mask.bounds,
          palette: {
            colors: colors,
            min: 'Shady',
            max: 'Sunny',
          },
          render: (showRoofOnly) => [
            renderPalette({
              data: data,
              mask: showRoofOnly ? mask : undefined,
              colors: colors,
              min: 0,
              max: 1800,
            }),
          ],
        };
      },
      monthlyFlux: async () => {
        const [mask, data] = await Promise.all([
          this.downloadGeoTIFF(urls.maskUrl, googleMapsApiKey),
          this.downloadGeoTIFF(urls.monthlyFluxUrl, googleMapsApiKey),
        ]);
        const colors = ironPalette;
        return {
          id: layerId,
          bounds: mask.bounds,
          palette: {
            colors: colors,
            min: 'Shady',
            max: 'Sunny',
          },
          render: (showRoofOnly) =>
            [...Array(12).keys()].map((month) =>
              renderPalette({
                data: data,
                mask: showRoofOnly ? mask : undefined,
                colors: colors,
                min: 0,
                max: 200,
                index: month,
              }),
            ),
        };
      },
      hourlyShade: async () => {
        const [mask, ...months] = await Promise.all([
          this.downloadGeoTIFF(urls.maskUrl, googleMapsApiKey),
          ...urls.hourlyShadeUrls.map((url) => this.downloadGeoTIFF(url, googleMapsApiKey)),
        ]);
        const colors = sunlightPalette;
        return {
          id: layerId,
          bounds: mask.bounds,
          palette: {
            colors: colors,
            min: 'Shade',
            max: 'Sun',
          },
          render: (showRoofOnly, month, day) =>
            [...Array(24).keys()].map((hour) =>
              renderPalette({
                data: {
                  ...months[month],
                  rasters: months[month].rasters.map((values) =>
                    values.map((x) => x & (1 << (day - 1))),
                  ),
                },
                mask: showRoofOnly ? mask : undefined,
                colors: colors,
                min: 0,
                max: 1,
                index: hour,
              }),
            ),
        };
      },
    };
    try {
      return get[layerId]();
    } catch (e) {
      console.error(`Error getting layer: ${layerId}\n`, e);
      throw e;
    }
  }

}
