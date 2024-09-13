import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GoogleMap } from '@angular/google-maps';
import { ButtonModule } from 'primeng/button';
import { PrimeNGConfig } from 'primeng/api';
import { SearchBarComponent } from './shared/components/search-bar/search-bar.component';
import { Loader } from '@googlemaps/js-api-loader';
import { BuildingInsightsComponent } from './building-insights/building-insights.component';
import { BuildingInsightsResponse } from './shared/interfaces/solar.interface';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, GoogleMap, ButtonModule, SearchBarComponent, BuildingInsightsComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  
  title = 'solar-roof-estimator';
  googleMapsApiKey = 'AIzaSyBgBzxUb1STGGRI4gMGooODJYRVG_yUK9o';
  defaultPlace = {
    name: 'Rinconada Library',
    address: '1213 Newell Rd, Palo Alto, CA 94303',
  };
  location!: google.maps.LatLng;
  zoom = 19;
  @ViewChild('mapElement') mapElement!: ElementRef;
  geometryLibrary!: google.maps.GeometryLibrary | any;
  mapsLibrary!: google.maps.MapsLibrary | any;
  placesLibrary!: google.maps.PlacesLibrary | any;
  buildingInsights!: BuildingInsightsResponse | any;

  map!: google.maps.Map;
  constructor(
    private primengConfig: PrimeNGConfig
  ) { }

  ngOnInit() {
    this.primengConfig.ripple = true;
    this.loadGoogleMaps();
    
  }


  

  loadGoogleMaps() {
    // Load the Google Maps libraries.
    const loader = new Loader({ apiKey: this.googleMapsApiKey });
    // TODO: Fix Google Maps already loaded waring.
    const libraries = {
      geometry: loader.importLibrary('geometry'),
      maps: loader.importLibrary('maps'),
      places: loader.importLibrary('places'),
    };
    Promise.all(Object.values(libraries)).then(([geometry, maps, places]) => {
      this.geometryLibrary = geometry;
      this.mapsLibrary = maps;
      this.placesLibrary = places;

      // Get the address information for the default location.
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: this.defaultPlace.address }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK) {
          if (!results) return;
          const geocoderResult = results[0];

          // Initialize the map at the desired location.
          this.location = geocoderResult.geometry.location;
          console.log("From app",geocoderResult.geometry.location.lat(), geocoderResult.geometry.location.lng());
          this.map = new google.maps.Map(this.mapElement.nativeElement, {
            center: this.location,
            zoom: this.zoom,
            tilt: 0,
            mapTypeId: 'satellite',
            mapTypeControl: false,
            fullscreenControl: false,
            rotateControl: false,
            streetViewControl: false,
            zoomControl: false,
          });
        }
      });
    });
  }
}
