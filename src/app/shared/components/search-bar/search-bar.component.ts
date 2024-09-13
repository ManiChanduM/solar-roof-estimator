import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GoogleMap } from '@angular/google-maps';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { InputTextModule } from 'primeng/inputtext';


@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [GoogleMap, AutoCompleteModule, FormsModule, InputTextModule],
  templateUrl: './search-bar.component.html',
  styleUrl: './search-bar.component.scss'
})
export class SearchBarComponent implements OnInit, AfterViewInit {
  @Input('location') location!: google.maps.LatLng;
  @Input('placesLibrary') placesLibrary!: google.maps.PlacesLibrary;
  @Input('map') map!: google.maps.Map;
  @Input('initialValue') initialValue!: string;
  @Input('zoom') zoom!: number;
  @ViewChild('textFieldElement') textFieldElement!: ElementRef;
  autocomplete!: google.maps.places.Autocomplete;


  ngOnInit() {

  }


  ngAfterViewInit() {
    this.autocomplete = new google.maps.places.Autocomplete(this.textFieldElement.nativeElement, {
      fields: ['formatted_address', 'geometry', 'name'],
    });
    this.autocomplete.addListener('place_changed', async () => {
      const place: any = this.autocomplete?.getPlace();

      if (!place.geometry || !place.geometry.location) {
        this.textFieldElement.nativeElement.value = '';
        return;
      }
      if (place.geometry.viewport) {
        this.map.fitBounds(place.geometry.viewport);
        this.map.setCenter(place.geometry.location);

        // this.updatedLocation = new google.maps.LatLng(place.geometry.location.lat(), place.geometry.location.lng());
        this.map.setZoom(this.zoom);
      } else {
        this.map.setCenter(place.geometry.location);
        this.map.setZoom(this.zoom);
      }
      // location = place.geometry.location;
      if (place.name) {
        this.textFieldElement.nativeElement.value = place.name;
      } else if (place.formatted_address) {
        this.textFieldElement.nativeElement.value = place.formatted_address;
      }

    });
  }
}
