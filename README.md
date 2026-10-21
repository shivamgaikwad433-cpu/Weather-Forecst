# SkyCast — Weather Dashboard

SkyCast is a responsive, real-time weather dashboard built with plain HTML, CSS, and vanilla JavaScript. It uses OpenWeatherMap to show current conditions, a 24-hour outlook, and a five-day forecast for a searched or device location.

## Features

- Search by city, submit with Enter, and choose autocomplete suggestions.
- Load Pune on a first visit and remember the last searched city.
- Request the current location using browser geolocation.
- Current conditions include local date/time, feels-like temperature, humidity, wind, pressure, visibility, sunrise, and sunset.
- Hourly and five-day forecasts with weather icons and daily temperature ranges.
- Switch between Celsius and Fahrenheit without another API request.
- Weather-responsive backgrounds, plus a light/dark theme saved in the browser.
- Recent searches for up to five cities.
- Loading feedback and helpful messages for common API, connection, and location errors.
- Responsive layout, keyboard-friendly controls, visible focus indicators, and safe text rendering.

## Tech stack

- HTML5 for accessible page structure
- CSS3 for responsive layout, theme variables, glass effects, and animations
- Vanilla JavaScript (ES6+) for API requests, rendering, state, and browser storage
- OpenWeatherMap Current Weather, 5-day / 3-hour Forecast, and Geocoding APIs

## Screenshots

Add screenshots here when you have captured the app:

![SkyCast dashboard screenshot](screenshots/skycast-dashboard.png)

## Setup

1. Create an account at [OpenWeatherMap](https://openweathermap.org/) and generate an API key from your account dashboard. New keys can take a little while to become active.
2. Copy `config.example.js` to `config.js` in the project folder.
3. Replace `YOUR_OPENWEATHERMAP_API_KEY` in `config.js` with your key. Keep `config.js` private; it is listed in `.gitignore`.
4. Open `index.html` through a local web server. The browser blocks reliable API requests from pages opened directly with a `file://` URL.

## Run locally

The easiest option is VS Code's Live Server extension: open the project folder, right-click `index.html`, and choose **Open with Live Server**. Alternatively, serve the folder with any static local web server and visit its local URL.

The dashboard tries to load Pune automatically. Search for a city, select a suggestion, switch units or theme, or allow location access to try the location button.

## Deploy

### GitHub Pages

1. Commit and push the project files to a GitHub repository. Do not commit `config.js`.
2. In repository **Settings → Pages**, choose the branch and folder containing `index.html`.
3. Publish the site and visit the Pages URL.

### Netlify

1. Import the repository in Netlify or drag the static project files into a deploy.
2. Set the publish directory to the project root; there is no build command.
3. Deploy and open the generated site URL.

> **API key note:** Browser-only applications cannot keep an API key secret from site visitors. The included `.gitignore` prevents accidental repository commits. For a public production site, route requests through a small serverless/backend proxy and restrict/rotate the key in the OpenWeatherMap account.

## Future improvements

- Add a small canvas temperature trend graph and weather alerts.
- Provide richer screen-reader announcements for forecast refreshes.
- Add configurable units for wind and distance, and a configurable default city.
- Introduce an API proxy and caching layer for a public production deployment.
- Add automated cross-browser and accessibility checks.
