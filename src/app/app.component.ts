import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GoogleMap } from '@angular/google-maps';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, GoogleMap],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'solar-roof-estimator';
  center!: google.maps.LatLngLiteral | undefined;
  display!: google.maps.LatLngLiteral | undefined;
  options: google.maps.MapOptions = {
    center: { lat: 40, lng: -100 },
    zoom: 4
  };

  moveMap(event: google.maps.MapMouseEvent) {
    this.center = (event.latLng?.toJSON());
  }

  move(event: google.maps.MapMouseEvent) {
    this.display = event.latLng?.toJSON();
  }
}
