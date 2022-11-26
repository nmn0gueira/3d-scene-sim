precision highp float;

uniform vec4 uColor;

varying vec3 fNormal;

void main() {
    if (uColor == vec4(0.57,0.56,0.56,1.0)) // Color of lake holder 
        gl_FragColor = 0.95*uColor + 0.05*vec4(fNormal,1.0); // To look less "rainbow-y"
    else
        gl_FragColor = 0.8*uColor + 0.2*vec4(fNormal,1.0);
}