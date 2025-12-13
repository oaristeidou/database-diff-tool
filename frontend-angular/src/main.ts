import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
// Ensure Zone.js is loaded (required for default Angular change detection)
// In some setups, the CLI may not auto-inject zone.js; importing it here avoids NG0908 runtime errors.
import 'zone.js';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [provideAnimations()]
}).catch(err => console.error(err));
