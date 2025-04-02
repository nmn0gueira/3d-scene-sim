# 3D Hierarchical Scene Modeling

This project is a 3D simulation of a helicopter that allows for vertical and circular movement, with some object interaction (e.g., dropping cargo), and camera control. The helicopter is modeled using basic 3D primitives (cylinders, cubes, and spheres), and the scene is rendered using Three.js.

## How to Run
1. **Clone the repository** to your local machine.
   
2. **Open the project folder** in Visual Studio Code.

3. **Install the Live Server extension** in Visual Studio Code if you haven't already.

4. **Start the Live Server**:
- Right-click on the `index.html` file in the file explorer and select **"Open with Live Server"**.
- Alternatively, click the **Go Live** button in the bottom-right corner of the VS Code window to start the server.


## Controls
- **Helicopter**:
  - Vertical movement (up and down) controlled by the **Arrow Up (↑)** and **Arrow Down (↓)** keys.
  - Circular movement around the Y-axis with a minimum radius of 30 units, controlled by the **Arrow Left (←)** key.
  - Press **Space** to release a cargo box that drops vertically under gravity. The cargo disappears 5 seconds after being dropped.

- **Camera Views**:
  - **1**: Default axonometric projection.
  - **2**: Front view (main elevation).
  - **3**: Top view (plan).
  - **4**: Right-side elevation.
  - **5**: Camera positioned on the helicopter, pointing forward.

- **Other**:
  - **W**: Toggle between wireframe mode.
  - **S**: Toggle between solid mode with filled surfaces.
  - You can control the projection angles θ and γ via **sliders**.

## About
Developed as part of the Computer Graphics and Interfaces (2022/23) course at FCT NOVA.
