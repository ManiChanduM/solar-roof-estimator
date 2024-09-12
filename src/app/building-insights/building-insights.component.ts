import { Component, Input, OnInit } from '@angular/core';
import { BuildingInsightsResponse, RequestError, SolarPanelConfig } from '../shared/interfaces/solar.interface';
import { BuildingInsightsService } from '../shared/services/building-insights.service';
import { CommonModule, JsonPipe } from '@angular/common';
import { createPalette, normalize, rgbToColor } from './../shared/utils/visualize';
import { panelsPalette } from './../shared/utils/colors';

@Component({
  selector: 'app-building-insights',
  standalone: true,
  imports: [JsonPipe, CommonModule],
  templateUrl: './building-insights.component.html',
  styleUrl: './building-insights.component.scss'
})
export class BuildingInsightsComponent implements OnInit {

  expandedSection!: string;
  buildingInsights!: BuildingInsightsResponse | any;
  configId!: number;
  panelCapacityWatts!: number;
  showPanels  = true;

  @Input('googleMapsApiKey') googleMapsApiKey!: string;
  @Input('geometryLibrary') geometryLibrary!: google.maps.GeometryLibrary;
  @Input('location') location!: google.maps.LatLng;
  @Input('map') map!: google.maps.Map;

  icon = 'home';
  title = 'Building Insights endpoint';

  requestSent = false;
  requestError: RequestError | undefined;
  // apiResponseDialog: MdDialog;

  panelConfig: SolarPanelConfig | any;

  // Config Id base value
  defaultPanelCapacity!: number;
  panelCapacityRatio!: number;

  // User settings
  monthlyAverageEnergyBillInput = 300;
  panelCapacityWattsInput = 250;
  energyCostPerKwhInput = 0.31;
  dcToAcDerateInput = 0.85;

  // Find the config that covers the yearly energy consumption.
  yearlyKwhEnergyConsumption!: number;


  constructor(private buildingInsightsService: BuildingInsightsService,) { }

  ngOnInit() {


  }

  // Building Insights Config
  buildingInsightsReq() {
  }

  ngOnChanges() {
    if (this.location) {
      this.buildingInsightsService.findClosestBuilding(this.location, this.googleMapsApiKey).subscribe(res => {
        this.buildingInsights = res;
        console.log(this.buildingInsights);


        if (!this.configId) {
          this.defaultPanelCapacity = this.buildingInsights.solarPotential.panelCapacityWatts;
          this.yearlyKwhEnergyConsumption = (this.monthlyAverageEnergyBillInput / this.energyCostPerKwhInput) * 12;
          this.panelCapacityRatio = this.panelCapacityWattsInput / this.defaultPanelCapacity;
          this.configId = this.findSolarConfig(this.buildingInsights.solarPotential.solarPanelConfigs, this.yearlyKwhEnergyConsumption, this.panelCapacityRatio, this.dcToAcDerateInput);
          this.setPanelConfig(this.configId);
          console.log('Panel Count:', this.panelConfig.panelsCount);
          console.log('Max Panels', this.buildingInsights.solarPotential.solarPanels.length);
          console.log('Yearly Energy', this.panelConfig.yearlyEnergyDcKwh * this.panelCapacityRatio);
        }
      }, err => {
        console.error('GET buildingInsights error\n', err);
        this.requestError = err.error;
      });
    }
  }

  findSolarConfig(solarPanelConfigs: SolarPanelConfig[], yearlyKwhEnergyConsumption: number, panelCapacityRatio: number, dcToAcDerateInput: number) {
    return solarPanelConfigs.findIndex(
      (config) =>
        config.yearlyEnergyDcKwh * panelCapacityRatio * dcToAcDerateInput >= yearlyKwhEnergyConsumption,
    );
  }

  setPanelConfig(configId: number) {
    this.configId = configId;
    this.panelConfig = this.buildingInsights.solarPotential.solarPanelConfigs[this.configId];
  }

  solarPanels: google.maps.Polygon[] = [];

  setSolarPanels() {
    // Create the solar panels on the map.
    const solarPotential = this.buildingInsights.solarPotential;
    const palette = createPalette(panelsPalette).map(rgbToColor);
    const minEnergy = solarPotential.solarPanels.slice(-1)[0].yearlyEnergyDcKwh;
    const maxEnergy = solarPotential.solarPanels[0].yearlyEnergyDcKwh;
    this.solarPanels.map((panel) => panel.setMap(null));
    this.solarPanels = [];
    this.solarPanels = solarPotential.solarPanels.map((panel: any) => {
      const [w, h] = [solarPotential.panelWidthMeters / 2, solarPotential.panelHeightMeters / 2];
      const points = [
        { x: +w, y: +h }, // top right
        { x: +w, y: -h }, // bottom right
        { x: -w, y: -h }, // bottom left
        { x: -w, y: +h }, // top left
        { x: +w, y: +h }, //  top right
      ];
      const orientation = panel.orientation == 'PORTRAIT' ? 90 : 0;
      const azimuth = solarPotential.roofSegmentStats[panel.segmentIndex].azimuthDegrees;
      const colorIndex = Math.round(normalize(panel.yearlyEnergyDcKwh, maxEnergy, minEnergy) * 255);
      return new google.maps.Polygon({
        paths: points.map(({ x, y }) =>
          this.geometryLibrary.spherical.computeOffset(
            { lat: panel.center.latitude, lng: panel.center.longitude },
            Math.sqrt(x * x + y * y),
            Math.atan2(y, x) * (180 / Math.PI) + orientation + azimuth,
          ),
        ),
        strokeColor: '#B0BEC5',
        strokeOpacity: 0.9,
        strokeWeight: 1,
        fillColor: palette[colorIndex],
        fillOpacity: 0.9,
      });
    });

    this.solarPanels.map((panel, i) =>
      panel.setMap(this.showPanels && this.panelConfig && i < this.panelConfig.panelsCount ? this.map : null),
    );

  }




}
