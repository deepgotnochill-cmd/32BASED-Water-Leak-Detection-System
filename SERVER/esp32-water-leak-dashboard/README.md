# ESP32-Based Water Leak Detection System Dashboard

This project provides a dashboard for monitoring the ESP32-based water leak detection system. The dashboard is built using HTML, CSS, and JavaScript, and it runs a local HTTP server to serve the dashboard files.

## Project Structure

```
esp32-water-leak-dashboard
├── .vscode
│   ├── tasks.json
│   └── launch.json
├── dashboard
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── server
│   └── start_server.py
├── README.md
```

## Getting Started

### Prerequisites

- Python 3.x installed on your machine.
- Visual Studio Code installed with the Python extension.

### How to Start the Dashboard with One Click in VS Code

1. Open the Command Palette (Ctrl + Shift + P).
2. Type "Debug: Start Debugging" or press F5.
3. Select "Start Dashboard" from the list of configurations.

This will start the HTTP server and automatically open the dashboard in your default web browser.

### How to Stop the Dashboard

- You can stop the server by clicking the stop button in the debug toolbar or by using the Command Palette and selecting "Debug: Stop Debugging".

### Preservation of Existing Dashboard and Three.js Visualization

The existing dashboard files (`index.html`, `styles.css`, `app.js`) and the Three.js visualization remain unchanged. The new configurations only facilitate the startup process without altering any existing functionality or files.

### Acknowledgments

- This project utilizes the ESP32 microcontroller for water leak detection.
- The dashboard is designed to provide real-time monitoring and visualization of the system's status.