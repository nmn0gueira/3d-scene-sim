import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { ortho, lookAt, flatten } from "../../libs/MV.js";
import { modelView, loadMatrix, multRotationX, multRotationZ, multRotationY, multScale, multTranslation, pushMatrix, popMatrix } from "../../libs/stack.js";

import * as SPHERE from '../../libs/objects/sphere.js';
import * as CUBE from '../../libs/objects/cube.js'
import * as CYLINDER from '../../libs/objects/cylinder.js'


/** @type WebGLRenderingContext */
let gl;

let time = 0;           // Global simulation time in days
let speed = 1 / 60.0;     // Speed (how many days added to time on each render pass)
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let animation = true;   // Animation is running

const PLANET_SCALE = 10;    // scale that will apply to each planet and satellite
const ORBIT_SCALE = 1 / 60;   // scale that will apply to each orbit around the sun

const SUN_DIAMETER = 1391900;
const SUN_DAY = 24.47; // At the equator. The poles are slower as the sun is gaseous

const MERCURY_DIAMETER = 4866 * PLANET_SCALE;
const MERCURY_ORBIT = 57950000 * ORBIT_SCALE;
const MERCURY_YEAR = 87.97;
const MERCURY_DAY = 58.646;

const VENUS_DIAMETER = 12106 * PLANET_SCALE;
const VENUS_ORBIT = 108110000 * ORBIT_SCALE;
const VENUS_YEAR = 224.70;
const VENUS_DAY = 243.018;

const EARTH_DIAMETER = 12742 * PLANET_SCALE;
const EARTH_ORBIT = 149570000 * ORBIT_SCALE;
const EARTH_YEAR = 365.26;
const EARTH_DAY = 0.99726968;

const MOON_DIAMETER = 3474 * PLANET_SCALE;
const MOON_ORBIT = 363396 * ORBIT_SCALE * 60;
const MOON_YEAR = 28;
const MOON_DAY = 0;

const VP_DISTANCE = 50; //antes estava EARTH_ORBIT



function setup(shaders) {
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    gl = setupWebGL(canvas);

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    let mProjection = ortho(-VP_DISTANCE * aspect, VP_DISTANCE * aspect, -VP_DISTANCE, VP_DISTANCE, -3 * VP_DISTANCE, 3 * VP_DISTANCE);
    let mView = lookAt([0, VP_DISTANCE, VP_DISTANCE], [0, 0, 0], [0, 1, 0]);

    mode = gl.LINES;

    resize_canvas();
    window.addEventListener("resize", resize_canvas);

    document.onkeydown = function (event) {
        switch (event.key) {
            case 'w':
                mode = gl.LINES;
                break;
            case 's':
                mode = gl.TRIANGLES;
                break;
            case 'p':
                animation = !animation;
                break;
            case '+':
                if (animation) speed *= 1.1;
                break;
            case '-':
                if (animation) speed /= 1.1;
                break;
            case '2':
                //frente
                mView = lookAt([-1, 0, 0], [0, 0, 0], [0, 1, 0]);
                break;
            case '3':
                //cima
                mView = lookAt([0, 1, 0], [0, 0, 0], [0, 0, -1]);
                break;
            case '4':
                //lado direito , nest momento esta a nostrar a parte de tras
                mView = lookAt([0, 0, 1], [0, 0, 0], [0, 1, 0]);
                break;
            case 'k':
                //regressa ao normal, nao e para o trabalho, so para ajudar
                mView = lookAt([0, VP_DISTANCE, VP_DISTANCE], [0, 0, 0], [0, 1, 0]);
                break;

        }
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    SPHERE.init(gl);
    CUBE.init(gl);
    CYLINDER.init(gl);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test

    window.requestAnimationFrame(render);


    function resize_canvas(event) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;

        gl.viewport(0, 0, canvas.width, canvas.height);
        mProjection = ortho(-VP_DISTANCE * aspect, VP_DISTANCE * aspect, -VP_DISTANCE, VP_DISTANCE, -3 * VP_DISTANCE, 3 * VP_DISTANCE);
    }

    function uploadModelView() {
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelView()));
    }

    function setColor(color) {
        gl.useProgram(program);

        const uColor = gl.getUniformLocation(program, "uColor");

        gl.uniform4fv(uColor, color);
    }

    function buildBody() {

        multScale([20, 10, 10]);

        let color = [1.0,0.0,0.0,1.0];  //Red
        setColor(color); 

        // Send the current modelview matrix to the vertex shader
        uploadModelView();

        // Draw a sphere representing the sun
        SPHERE.draw(gl, program, mode);

    }

    function buildTail() {
        multTranslation([15, 2, 0]); // 15 = 3xBody/4, 2 = yBody/5
        pushMatrix();
            helicopterTail1();
        popMatrix();
        pushMatrix();
            multTranslation([12.5, 5, 0]); // 12.5 = xTail1/2, 10 = yTail1*2
            multRotationZ(70);  // tail2 rotation 
            pushMatrix();
                helicopterTail2();
            popMatrix();
            pushMatrix();
                buildTailRotorSystem();
            popMatrix();
        popMatrix();
    }

    function buildUpperRotor() {
        multTranslation([0, 5, 0]); // 5 = yBody/2 
        pushMatrix();
            helixHolder();
        popMatrix();
        multRotationY(time * 360 * 2);
        pushMatrix();
            multTranslation([10, 5 / 4, 0]); //10 = xBody/2, y = yHelixHolder/4
            mainHelix();
        popMatrix();
        pushMatrix();
            multRotationY(120);    
            multTranslation([10, 5 / 4, 0]);
            mainHelix();
        popMatrix();
        pushMatrix();
            multRotationY(240);
            multTranslation([10, 5 / 4, 0]);
            mainHelix();
        popMatrix();
    }

    function buildLowerBody() {
        pushMatrix();    
            multTranslation([-6, -5, 4]);   //-6 = -(3xBody/10), -5 = -(yBody/2), 4 = (2zBody/5)
            multRotationX(150); 
            multRotationZ(15); 
            supportLeg();
        popMatrix();
        pushMatrix();
            multTranslation([6,-5,4]);      //6 = (3xBody/10), -5 = -(yBody/2), 4 = (2zBody/5)
            multRotationX(150);
            multRotationZ(-15); 
            supportLeg();
        popMatrix();
        pushMatrix();
            multTranslation([6,-5,-4]);     //6 = (3xBody/10), -5 = -(yBody/2), -4 = -(2zBody/5)
            multRotationX(-150);
            multRotationZ(-15); 
            supportLeg();
        popMatrix();
        pushMatrix();
            multTranslation([-6,-5,-4]);    //-6 = -(3xBody/10), -5 = -(yBody/2), -4 = -(2zBody/5)
            multRotationX(-150);
            multRotationZ(15); 
            supportLeg();
        popMatrix();

        pushMatrix();
            multTranslation([0,-7.5,5]); //-7.5 = -(yBody/2 + yHelixHolder/2), 6 = (2zBody/5) + zHelixHolder/2
            multRotationX(90);
            landingGear();
        popMatrix();

        pushMatrix();
            multTranslation([0,-7.5,-5]); //-7.5 = -(yBody/2 + yHelixHolder/2), 6 = (2zBody/5) + zHelixHolder/2
            multRotationX(90);
            landingGear();
        popMatrix();
    }

    function helicopterTail1() {

        multScale([25, 5, 5]);  // 25 = xBody+xBody/4, 5 = yBody/2, 5 = zBody/2

        // Send the current modelview matrix to the vertex shader
        uploadModelView();

        // Draw a sphere representing the sun
        SPHERE.draw(gl, program, mode);

    }

    function helicopterTail2() {

        multScale([12.5, 5, 5]);  //12.5 = xTail1/2, 5 = yTail1, 5 = zTail1

        // Send the current modelview matrix to the vertex shader
        uploadModelView();

        // Draw a sphere representing the sun
        SPHERE.draw(gl, program, mode);

    }

    function buildTailRotorSystem() {
        multRotationX(90);
        pushMatrix();//
            helixHolder();
        popMatrix(); //
        pushMatrix(); // pode se retirar acho
            multRotationY(time * 360 * 2); // two cycles per second
            pushMatrix();
                multTranslation([4, 2.5, 0]);  //4 = xHelixHolder*2, 2.5 = yHelixHolder/2
                tailHelix();
            popMatrix();
            pushMatrix();
                multTranslation([-4, 2.5, 0]); //4 = -xHelixHolder*2, 2.5 = yHelixHolder/2
                tailHelix();
            popMatrix();
        popMatrix(); // pode se retirar acho
    }

    function helixHolder() {
        multScale([2, 5, 2]);

        let color = [1.0,1.0,0.0,1.0]; // Amarelo
        setColor(color); 

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
    }

    function tailHelix() {
        multScale([12.5/2, 1, 2.5]);  //12.5 = xTail2/2, 1 = yTail2/5, 2.5 = zTail2/2

        let color = [0.0,0.0,1.0,1.0]; // Azul
        setColor(color);

        uploadModelView();

        SPHERE.draw(gl, program, mode);
     }
     
     function mainHelix() {
        multScale([25, 1, 2.5]); // 25 = xTailHelix*2, 5 = yTailHelix, 2.5 = zTailHelix

        let color = [0.0,0.0,1.0,0.0];  //Blue
        setColor(color);    

        uploadModelView();

        SPHERE.draw(gl, program, mode);
    }

    function supportLeg() {
        multScale([2, 5, 2]);  // metricas do helixHolder

        let color = [0.2,0.2,0.2,1.0];
        setColor(color);

        // Send the current modelview matrix to the vertex shader
        uploadModelView();

        // Draw a sphere representing the sun
        CUBE.draw(gl, program, mode);
    }

    function landingGear() {
        multScale([20.0, 2.5, 2.5]);

        let color = [1.0,1.0,0.0,1.0]; // Amarelo
        
        setColor(color);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
    }

    function buildHelicopter() {
        pushMatrix();
            buildBody();
        popMatrix();

        pushMatrix();
            buildTail();
        popMatrix();

        pushMatrix();
            buildUpperRotor();
        popMatrix();

        pushMatrix();
            buildLowerBody();
        popMatrix();

    }


    function render() {
        if (animation) time += speed;
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(program);

        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));

        loadMatrix(mView);

        //translaçao e rotaçao do helicoptero para fazer aqui (valores a toa para ver o helicoptero a mexer)
        multScale([0.1,0.1,0.1]);
        multRotationY(time*360/4);
        multTranslation([500,0,0]); 
        buildHelicopter();

    }
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))