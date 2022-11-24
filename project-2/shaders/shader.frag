precision highp float;

uniform vec4 uColor;

varying vec3 fNormal;

void main() {
    gl_FragColor = 0.8*uColor + 0.2*vec4(fNormal,1.0);
}