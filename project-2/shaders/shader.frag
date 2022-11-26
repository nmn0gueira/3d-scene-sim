precision highp float;

uniform vec4 uColor;

varying vec3 fNormal;

void main() {
    if (uColor.x < 0.60 && uColor.y < 0.60 && uColor.z < 0.60) // Darker colors
        gl_FragColor = 0.95*uColor + 0.05*vec4(fNormal,1.0); // To look less "rainbow-y"
    else
        gl_FragColor = 0.8*uColor + 0.2*vec4(fNormal,1.0);
}