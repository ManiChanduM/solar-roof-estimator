import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DataLayersService } from './../shared/services/data-layers.service';
import { BuildingInsightsResponse, DataLayersResponse, LayerId, RequestError } from '../shared/interfaces/solar.interface';
import { Layer } from '../shared/interfaces/layers.interface';
import { BuildingInsightsService } from '../shared/services/building-insights.service';
import { ButtonModule } from 'primeng/button';
import { RadioButtonModule } from 'primeng/radiobutton';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-data-layers',
  standalone: true,
  imports: [ButtonModule, CommonModule, RadioButtonModule, FormsModule],
  templateUrl: './data-layers.component.html',
  styleUrl: './data-layers.component.scss'
})
export class DataLayersComponent implements OnInit {
  @Input('googleMapsApiKey') googleMapsApiKey!: string;
  @Input('buildingInsights') buildingInsights!: BuildingInsightsResponse;
  @Input('geometryLibrary') geometryLibrary!: google.maps.GeometryLibrary;
  @Input('map') map!: google.maps.Map;
  @Input('location') location!: google.maps.LatLng;

  icon = 'layers';
  title = 'Data Layers endpoint';
  isLoading = true;

  dataLayerOptions: Record<LayerId | 'none', string> = {
    none: 'No layer',
    mask: 'Roof mask',
    dsm: 'Digital Surface Model',
    rgb: 'Aerial image',
    annualFlux: 'Annual sunshine',
    monthlyFlux: 'Monthly sunshine',
    hourlyShade: 'Hourly shade',
  };

  monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  showMonthlyFlux = false;

  dataLayersResponse!: DataLayersResponse | undefined;
  requestError!: RequestError | undefined;
  // apiResponseDialog!: MdDialog;
  layerId: LayerId | any = 'monthlyFlux';
  layer!: Layer | undefined;
  imageryQuality!: 'HIGH' | 'MEDIUM' | 'LOW';

  playAnimation = true;
  tick = 0;
  month = 4;
  day = 14;
  hour = 0;

  overlays: google.maps.GroundOverlay[] = [];
  showRoofOnly = true;
  ingredient: any;

  fluxType = 'monthlyFlux';

  constructor(private dataLayersService: DataLayersService,
    private buildingInsightsService: BuildingInsightsService
  ) { }

  ngOnChanges() {
    if (this.buildingInsights) {
      this.showDataLayer();
    }
  }

  ngOnInit() {
  }

  // setMapOverlay() {
  //   if (this.layer?.id == 'monthlyFlux') {
  //     this.overlays.map((overlay, i) => overlay.setMap(i == this.month ? this.map : null));
  //   } else if (this.layer?.id == 'hourlyShade') {
  //     this.overlays.map((overlay, i) => overlay.setMap(i == this.hour ? this.map : null));
  //   }
  // }

  // onSliderChange(event: Event) {
  //   // const target: any = event.target; // as MdSlider
  //   // if (this.layer?.id == 'monthlyFlux') {
  //   //   if (target.valueStart != this.month) {
  //   //     this.month = target.valueStart ?? 0;
  //   //   } else if (target.valueEnd != this.month) {
  //   //     this.month = target.valueEnd ?? 0;
  //   //   }
  //   //   this.tick = this.month;
  //   // } else if (this.layer?.id == 'hourlyShade') {
  //   //   if (target.valueStart != this.hour) {
  //   //     this.hour = target.valueStart ?? 0;
  //   //   } else if (target.valueEnd != this.hour) {
  //   //     this.hour = target.valueEnd ?? 0;
  //   //   }
  //   //   this.tick = this.hour;
  //   // }
  // }

  // onMonthlyOrHourly() {
  //   // if (this.layer?.id == 'monthlyFlux') {
  //   //   if (this.playAnimation) {
  //   //     this.month = this.tick % 12;
  //   //   } else {
  //   //     this.tick = this.month;
  //   //   }
  //   // } else if (this.layer?.id == 'hourlyShade') {
  //   //   if (this.playAnimation) {
  //   //     this.hour = this.tick % 24;
  //   //   } else {
  //   //     this.tick = this.hour;
  //   //   }
  //   // }
  // }

  async showDataLayer(reset = false) {
    this.isLoading = true;
    if (reset) {
      this.dataLayersResponse = undefined;
      this.requestError = undefined;
      this.layer = undefined;

      // Default values per layer.
      this.showRoofOnly = ['annualFlux', 'monthlyFlux', 'hourlyShade'].includes(this.layerId); // showRoofOnly if annual, monthly and hourly
      this.map.setMapTypeId(this.layerId == 'rgb' ? 'roadmap' : 'satellite');
      this.overlays.map((overlay) => overlay.setMap(null));
      this.month = this.layerId == 'hourlyShade' ? 3 : 0;
      this.day = 14;
      this.hour = 5;
      this.playAnimation = ['monthlyFlux', 'hourlyShade'].includes(this.layerId); // Play animation if monthlyFlux or hourslyShade
    }

    if (this.layerId == 'none') {
      return;
    }

    if (!this.layer) {
      const center = this.buildingInsights.center;
      const ne = this.buildingInsights.boundingBox.ne;
      const sw = this.buildingInsights.boundingBox.sw;
      const diameter = this.geometryLibrary.spherical.computeDistanceBetween(
        new google.maps.LatLng(ne.latitude, ne.longitude),
        new google.maps.LatLng(sw.latitude, sw.longitude),
      );
      const radius = Math.ceil(diameter / 2);

      this.dataLayersService.getDataLayerUrls(center, radius, this.googleMapsApiKey).subscribe(async (response: any) => {
        this.dataLayersResponse = response;
        if (this.dataLayersResponse) {
          this.imageryQuality = this.dataLayersResponse.imageryQuality;
          try {
            this.layer = await this.dataLayersService.getLayer(this.layerId, this.dataLayersResponse, this.googleMapsApiKey);
            console.log('Layer:', this.layer);
            const bounds = this.layer?.bounds;
            console.log('Render layer:', {
              layerId: this.layer?.id,
              showRoofOnly: this.showRoofOnly,
              month: this.month,
              day: this.day,
            });

            this.overlays.map((overlay) => overlay.setMap(null));
            if (this.layer && bounds) {
              this.overlays = this.layer
                .render(this.showRoofOnly, this.month, this.day)
                .map((canvas) => new google.maps.GroundOverlay(canvas.toDataURL(), bounds));

              if (!['monthlyFlux', 'hourlyShade'].includes(this.layer.id)) {
                this.overlays[0].setMap(this.map);
              }

              if (this.layer?.id == 'monthlyFlux') {
                this.overlays.map((overlay, i) => overlay.setMap(i == this.month ? this.map : null));
                this.showMonthlyFlux = true;
              }
            }
            this.isLoading = false;
          } catch (e) {
            this.requestError = e as RequestError;
            return;
          }
        }
      });
    }
  }

  onMonth(month: number) {
    this.month = month;
    this.overlays.map((overlay, i) => overlay.setMap(i == month ? this.map : null));
  }

  onFluxChange() {
    if (this.layerId == 'monthlyFlux') {
      this.layer = undefined;
      this.showDataLayer();
    } else if (this.layerId == 'annualFlux') {
      this.layer = undefined;
      this.showDataLayer();
    }

  }
}
