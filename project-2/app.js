import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { ortho, lookAt, flatten, vec4, inverse, mult, rotateX, rotateY, subtract, normalize } from "../../libs/MV.js";
import { modelView, loadMatrix, multRotationX, multRotationZ, multRotationY, multScale, multTranslation, pushMatrix, popMatrix } from "../../libs/stack.js";

import * as SPHERE from '../../libs/objects/sphere.js';
import * as CUBE from '../../libs/objects/cube.js'
import * as CYLINDER from '../../libs/objects/cylinder.js'
import * as TORUS from '../../libs/objects/torus.js'
import * as PYRAMID from '../../libs/objects/pyramid.js'
import { GUI } from "../libs/dat.gui.module.js";


/** @type WebGLRenderingContext */
let gl;

const WORLD_SCALE = 50; 
const EARTH_GRAVITY = 9.8;
const MAX_HEIGHT = 30;
const MAX_SPEED = 120;  //estava 2 com dt=1
const MAX_INCLINATION = 30;
const HELICOPTER_ACCELERATION = 120; // MAX_SPEED/(2^5)  estava 0.0625 com dt=1 assim (em 1 segundo atinge a velocidade maxima)
const HELICOPTER_INCLINATION = 0.9375; // Rule of three so helicopter reaches max inclination when max speed is reached
//const ANGULAR_VELOCITY = 2*Math.PI/3;   //It takes 3 seconds to do one lap around the y axis at max speed
//const LINEAR_VELOCITY = 30*ANGULAR_VELOCITY;


// Views
const AXONOMETRIC = "Axonometric";
const FRONT = "Front";
const TOP = "Top";
const RIGHT = "Right";
const HELICOPTER = "Helicopter";

let time = 0;           // Global simulation time in seconds
let lastTime = 0;       // Last animation time
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let objectProps = {gamma:0, theta:0};
let view = AXONOMETRIC; // the program starts with axonometric projection
let keysPressed = [];

//Helicopter related
let speed = 0;          // Speed the helicopter is rotating around the Y axis
let height = 0;
let movement = 0;       // Y axis rotation related to the center of the world
let lastMovement= 0;
let inclination = 0;    // X axis rotation on the helicopter
let position;           // World coordinates of the helicopter
let front;              // 
let boxes = [];         // Boxes the helicopter drops

let velocityDirection;   // Vector with the direction the helicopter is moving
let normaVelocidade;       //30 É O RAIO

function setup(shaders) {
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;
    const gui = new GUI();

    gl = setupWebGL(canvas);

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    let mProjection = ortho(-WORLD_SCALE * aspect, WORLD_SCALE * aspect, -WORLD_SCALE, WORLD_SCALE, -3 * WORLD_SCALE, 3 * WORLD_SCALE);
    let mView;
    mode = gl.TRIANGLES;

    //Controls for the axonometric projection
    gui.add(objectProps, "gamma", 0, 360, 1).name("X");
    gui.add(objectProps, "theta", 0, 360, 1).name("Y");

    resize_canvas();
    window.addEventListener("resize", resize_canvas);

    document.onkeydown = onkeyup = function (event) {
        const type = event.type == 'keydown';
        keysPressed[event.key] = type;  
        
        // Space can be pressed for a single box or held for multiple boxes
        if (type && event.key == " " && height > 0) {
            //var toPush = boxes.length % 2 == 0 ? position : front;
            boxes.push({ time: time, velocity: [velocityDirection[0]*normaVelocidade,0, velocityDirection[2]*normaVelocidade], point: position});
        }
    }
 

    gl.clearColor(135/255, 206/255, 235/255, 1.0); // 135, 206, 235 Sky
    SPHERE.init(gl);
    CUBE.init(gl);
    CYLINDER.init(gl);
    TORUS.init(gl);
    PYRAMID.init(gl);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test

    window.requestAnimationFrame(render);


    function resize_canvas(event) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;

        gl.viewport(0, 0, canvas.width, canvas.height);
        mProjection = ortho(-WORLD_SCALE * aspect, WORLD_SCALE * aspect, -WORLD_SCALE, WORLD_SCALE, -3 * WORLD_SCALE, 3 * WORLD_SCALE);
    }

    function uploadModelView() {
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelView()));
    }

    function setColor(color) {
        gl.useProgram(program);

        const uColor = gl.getUniformLocation(program, "uColor");

        gl.uniform4fv(uColor, color);
    }

    function buildMainBody() {

        multScale([20, 10, 10]);

        let color = [1.0,0.0,0.0,1.0];  //Red
        setColor(color); 

        uploadModelView();

        SPHERE.draw(gl, program, mode);

    }

    function buildTail() {
        pushMatrix();
            helicopterTail1();
        popMatrix();
        multTranslation([12.5, 5, 0]); // 12.5 = xTail1/2, 10 = yTail1*2
        multRotationZ(70);  // tail2 rotation 
        pushMatrix();
            helicopterTail2();
        popMatrix();
        multRotationX(90);
        buildTailRotorSystem();
    }

    function buildUpperRotor() {
        //Helix holder
        pushMatrix();
            helixHolder();
        popMatrix();
        multRotationY(time * 360 * 2 ); //* velocityX
        //Helix 1
        pushMatrix();
            multTranslation([10, 5 / 4, 0]); //10 = xBody/2, y = yHelixHolder/4
            mainHelix();
        popMatrix();
        //Helix 2
        pushMatrix();
            multRotationY(120);    
            multTranslation([10, 5 / 4, 0]);
            mainHelix();
        popMatrix();
        //Helix 3
        multRotationY(240);
        multTranslation([10, 5 / 4, 0]);
        mainHelix();
    }

    function buildLowerBody() {
        //Support 1
        pushMatrix();    
            multTranslation([-6, -5, 4]);   //-6 = -(3xBody/10), -5 = -(yBody/2), 4 = (2zBody/5)
            multRotationX(150); 
            multRotationZ(15); 
            supportLeg();
        popMatrix();
        //Support 2
        pushMatrix();
            multTranslation([6,-5,4]);      //6 = (3xBody/10), -5 = -(yBody/2), 4 = (2zBody/5)
            multRotationX(150);
            multRotationZ(-15); 
            supportLeg();
        popMatrix();
        //Support 3
        pushMatrix();
            multTranslation([6,-5,-4]);     //6 = (3xBody/10), -5 = -(yBody/2), -4 = -(2zBody/5)
            multRotationX(-150);
            multRotationZ(-15); 
            supportLeg();
        popMatrix();
        //Support 4
        pushMatrix();
            multTranslation([-6,-5,-4]);    //-6 = -(3xBody/10), -5 = -(yBody/2), -4 = -(2zBody/5)
            multRotationX(-150);
            multRotationZ(15); 
            supportLeg();
        popMatrix();

        //Landing gear 1
        pushMatrix();
            multTranslation([0,-7.5,5]); //-7.5 = -(yBody/2 + yHelixHolder/2), 6 = (2zBody/5) + zHelixHolder/2
            multRotationX(90);
            landingGear();
        popMatrix();
        //Landing gear 2
        multTranslation([0,-7.5,-5]); //-7.5 = -(yBody/2 + yHelixHolder/2), 6 = (2zBody/5) + zHelixHolder/2
        multRotationX(90);
        landingGear();
    }

    function helicopterTail1() {

        multScale([25, 5, 5]);  // 25 = xBody+xBody/4, 5 = yBody/2, 5 = zBody/2

        uploadModelView();

        SPHERE.draw(gl, program, mode);

    }

    function helicopterTail2() {

        multScale([12.5, 5, 5]);  //12.5 = xTail1/2, 5 = yTail1, 5 = zTail1

        uploadModelView();

        SPHERE.draw(gl, program, mode);

    }

    function buildTailRotorSystem() {
        pushMatrix();
            helixHolder();
        popMatrix();
        multRotationY(time * 360 * 2 ); // * velocity
        pushMatrix();
            multTranslation([4, 2.5, 0]);  //4 = xHelixHolder*2, 2.5 = yHelixHolder/2
            tailHelix();
        popMatrix();
        multTranslation([-4, 2.5, 0]); //4 = -xHelixHolder*2, 2.5 = yHelixHolder/2
        tailHelix();
    }

    function helixHolder() {
        multScale([2, 5, 2]);

        let color = [1.0,1.0,0.0,1.0]; // Yellow
        setColor(color); 

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
    }

    function tailHelix() {
        multScale([12.5/2, 1, 2.5]);  //12.5 = xTail2/2, 1 = yTail2/5, 2.5 = zTail2/2

        let color = [0.0,0.0,1.0,1.0]; // Blue
        setColor(color);

        uploadModelView();

        SPHERE.draw(gl, program, mode);
     }
     
     function mainHelix() {
        multScale([25, 1, 2.5]); // 25 = xTailHelix*2, 5 = yTailHelix, 2.5 = zTailHelix

        let color = [0.0,0.0,1.0,0.0];  // Blue
        setColor(color);    

        uploadModelView();

        SPHERE.draw(gl, program, mode);
    }

    function supportLeg() {
        multScale([2, 5, 2]);  // metricas do helixHolder

        let color = [0.2,0.2,0.2,1.0];
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);
    }

    function landingGear() {
        multScale([20.0, 2.5, 2.5]); //20 = xBody, 2.5 = yTail1/2, 2.5 = zTail1/2

        let color = [1.0,1.0,0.0,1.0]; // Yellow
        
        setColor(color);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
    }

    function buildHelicopter() {
        pushMatrix();
            buildMainBody();
        popMatrix();
        pushMatrix();
            multTranslation([15, 2, 0]); // 15 = 3xBody/4, 2 = yBody/5
            buildTail();
        popMatrix();

        pushMatrix();
            multTranslation([0, 5, 0]); // 5 = yBody/2 
            buildUpperRotor();
        popMatrix();

        buildLowerBody();
    }

    function Plane() {
        multScale([125,1,125]); // 125 = 5/2* WORLD_SCALE

        let color =[146/255,193/255, 46/255,1.0];   // 146,193,46 Green 1
        //let color = [68/255,109/255,68/255,1.0];   // 68,109,68 Green 2 
        //let color = [68/255,88/255,15/255,1.0];   // 68,88,15 Green 3
        
        //let color = [42/255,41/255,34/255,1.0]; // 42, 41, 34 Asphalt
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);
    }

    function box() {
        multScale([4,2,1]); //20/5 10/5 5/5

        let color = [0.66,0.41,0.28,1.0]; // Green
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);
        
    }

    function Sun() {
        multScale([10,10,10]);  // 10 = WORLD_SCALE/5
  
        let color = [253/255,184/255,19/255,1.0]; // Color of the sun
        
        setColor(color);

        uploadModelView();

        SPHERE.draw(gl, program, mode);
    }

    // Used only right before drawing the helicopter
    function mModelPoint() {
        const mModel = mult(inverse(mView), modelView());
        
        position = mult(mModel, vec4(0.0,0.0,0.0,1.0));

        //front = mult(mModel, vec4(-5.0,0.0,0.0,1.0));  //Talvez usar isto para a camera  
        front = mult(mModel, vec4(-1.0,0.0,0.0,1.0));

        velocityDirection = normalize(subtract(front,position));
    }


    function Boxes() {
        for (const b of boxes) {
            if (time - b.time < 5) {
                pushMatrix();
                    //b.point[1] is the height at which the box was dropped
                    multTranslation([b.point[0],b.point[1],b.point[2]]);          
                    //1.5 = (yBox/2+yPlane/2)
                    // VERIFICAR SE FAZ MAIS SENTIDO COM DELTA TIME
                    if (b.point[1]-1.5 > 0) { // Box has not hit the ground

                        b.point[0] = b.point[0] + b.velocity[0];

                        //1.5 = (yBox/2+yPlane/2) 
                        //If box hits the ground or goes under it, set y position at 1.5 (ground level)
                        b.point[1] = b.point[1] - b.velocity[1] <= 1.5 ? 1.5 : b.point[1] - b.velocity[1];

                        b.point[2] = b.point[2] + b.velocity[2];
                        
                        
                        b.velocity[1] = b.velocity[1] + EARTH_GRAVITY/1000;
                    }
                    box();
                popMatrix();
            }
            //If a box has existed for more than 5 seconds it disappears
            else 
                boxes.shift();  // FIFO The box to disappear will always be the earliest dropped
        } 
    }









    //enviroment
    // ps para as cores usei um site, https://antongerdelan.net/colour/
    function lake(){
        multScale([10,0.5,10]);  // 10 = WORLD_SCALE/5 , 0.5 para ter alguma grossura
    
        multTranslation([0,0.7,0]);// tem que se elevar um bocadinho para aparecer. 0,04= 2*elevaçao do pavement
        let color = [0.0,0.51,0.91,1.0]; 
        
        setColor(color);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
        

    }
    //ver isto
    /*
    function lakeHolder(){
        multScale([12,2,12]);  // 10 = WORLD_SCALE/5
    
        multTranslation([0,0.7,0]);// tem que se elevar um bocadinho para aparecer. 0,04= 2*elevaçao do pavement
        let color = [0.25,0.25,0.25,1.0]; // Color of the sun
        
        setColor(color);

        uploadModelView();

        TORUS.draw(gl, program, mode);

    }*/
    function circularPavement(){
        multScale([25,0.5,25]);  // 25 = WORLD_SCALE/2, 0.5 para ter alguma grossura
    
        multTranslation([0,0.6,0]); //tem que se elevar um pouco para aparecer
        let color = [0.78,0.78,0.78,1.0]; 
        
        setColor(color);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);

    }

    function pavement(){
        multScale([10,0.5,125]);  // 125 = plane size, 10=* WORLD_SCALE/5, 0.5 para ter alguma grossura

        multTranslation([0,0.6,0]); //tem que se elevar um pouco para aparecer
        let color = [0.78,0.78,0.78,1.0]; 
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);

    }
//bench
//O BENCH PROVAVELMENTE TEM QUE SE REDUZIR DE TAMANHO
    function benchLeg(){
        multScale([2,0.7,0.5]);  //tamanhos random, pequenos para serem menor que o heli, 
        //exceto 0.7 que e para ter alguma parte que fique dentro do plane

        let color = [0.0,0.0,0.0,1.0]; 
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);


    }
    

    function benchSeat(){
        multScale([3,0.5,6]);  //tamanhos random, pequenos para serem menor que o heli,  

        //tem que se elevar um pouco para aparecer
        let color = [1.0,0.0,0.0,1.0]; 
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);
    }
    function benchBackrest(){
        multScale([3,0.5,6]); //mesmos tamanhos que o benchSeat

        let color = [1.0,0.0,0.0,1.0]; 
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);
    }

    //building

    function buildingBase(){
        multScale([75,20,125/6]);  //75=~ 2*125/3, 20 valor escolhido para altura, 125/6= para ter 1/6 do PLane

        let color = [0.98,0.68,0.38,1.0]; 
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);

    }

    function window1(){
        multScale([20/6,20/6,0.5]);  //75=~ 2*125/3, 20 valor escolhido para altura, 125/6= para ter 1/6 do PLane

        let color = [0.98,0.08,0.08,1.0]; 
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);
    }

    function baseRoof(){
        multScale([75-0.1,14.7,14.7]);  //75=~ 2*125/3, 20 valor escolhido para altura, 125/6= para ter 1/6 do PLane

        let color = [0.98,0.98,0.98,1.0]; 
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);

    }

    function corner(){

        multScale([2,20,2]);  //75=~ 2*125/3, 20 valor escolhido para altura, 125/6= para ter 1/6 do PLane

        let color = [0.78,0.78,0.78,1.0]; 
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);
    }

    
    function buildingCenter(){

        multScale([125/5,20,25]);  // 125/5= para ter 1/5 do tamanho do PLANE, 20 valor escolhido para altura  , 25= WORLD_SCALE/2

        let color = [0.08,0.68,0.38,1.0]; 
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);

    }

    function centerRoof(){
        multScale([17.7,17.7,125/5-0.2]); // 40=building center height

        let color = [0.53,0.57,5.0,1.0]; 
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode); 
    }


    function buildingEntrance(){
        
        multScale([25-0.2,20,5]);  //25=WORLD_SCALE, 20=ybuildingCenter ,5= Building center width/5

        let color = [0.93,0.87,0.81,1.0]; 
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);
    }

    function buildingDoors(){
        multScale([12.5/3,12.5/3,1]);  // 12.5/3 para ter 1/3 do comprimento e altura da entrance , 1 para ter alguma grossura

        let color = [0.63,0.36,0.10,1.0]; 
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);

    }
    function buildingPilar(){
        multScale([3,20,3]);  // 40=building center height

        let color = [0.93,0.87,0.81,1.0]; 
        
        setColor(color);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);

    }
    function buildingPilar2(){
        multScale([3,20,3]); // 40=building center height

        let color = [0.93,0.0,0.81,1.0]; 
        
        setColor(color);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);

    }
    function buildingPilar3(){
        multScale([3,20,3]); // 40=building center height

        let color = [0.0,0.87,0.81,1.0]; 
        
        setColor(color);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);

    }
    function buildingPilar4(){
        multScale([3,20,3]); // 40=building center height

        let color = [0.93,0.87,0.0,1.0]; 
        
        setColor(color);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);

    }

    function entranceRoof(){
        multScale([25 + 3,3,10]); // 40=building center height

        let color = [0.93,0.87,0.0,1.0]; 
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);

    }

    


    //trees
     function treeTrunk1(){
        multScale([1,5,1]);  // random

        let color = [0.32,0.17,0.03,1.0]; 
        
        setColor(color);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);

     }
     function treeLeaves1(){
        multScale([7,7,7]);  // random

        let color = [0.02,0.67,0.06,1.0]; 
        
        setColor(color);

        uploadModelView();

        SPHERE.draw(gl, program, mode);


     }

     function treeTrunk2(){
        multScale([1,5,1]);  // random

        let color = [0.52,0.24,0.01,1.0]; 
        
        setColor(color);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
     }

     function treeLeaves2(){
        multScale([7,7,7]);  // random

        let color = [0.51,0.81,0.42,1.0]; 
        
        setColor(color);

        uploadModelView();

        SPHERE.draw(gl, program, mode);


     }

     function pineTrunk(){
        multScale([3,9,3]);  // random

        let color = [0.52,0.24,0.01,1.0]; 
        
        setColor(color);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
        
     }

     function pineLeaves(){
        multScale([10,20,10]);  // random

        let color = [0.03,0.31,0.05,1.0]; 
        
        setColor(color);

        uploadModelView();

        PYRAMID.draw(gl, program, mode);


     }

    


    function World() {
        //Sun (EXPERIMENTAL)
        //pushMatrix();
        //    multTranslation([50, 30,0]);    // 50 = WORLD_SCALE, 30 = 3WORLD_SCALE/5
        //    Sun();
        //popMatrix();

        
        //SURFACE  
        pushMatrix();
            multRotationY(-45);
            pushMatrix();
                Plane();        //PLANE
            popMatrix();

            //enviroment 
            //ps pode ser melhorado como foi feto com as outras primitivas
            pushMatrix();   
                lake();         //LAKE
            popMatrix();
            /*
            pushMatrix();
                lakeHolder();   //LAKE HOLDER
            popMatrix();
            */
            pushMatrix();
                circularPavement(); //CIRCULAR PAVEMENT
            popMatrix();
            pushMatrix();
                pavement();         // PAVEMENT
            popMatrix();


            //bench (REVER ISTO MAIS TARDE)
            pushMatrix();
                multTranslation([5+1,0.7,50]); //6= 5(circularpavement WIDTH/2) + 1(benchleg LENGTH/2) 
                //0.7 para ficar com parte da altura "enterrada no Plane", 50 valor random para ficar quase no limite do plane
                pushMatrix();
                    benchLeg();
                popMatrix();

                pushMatrix();
                    multTranslation([0,0,-3]);  // para ficar a 3 de distancia
                    benchLeg();
                popMatrix();

                pushMatrix();
                    multTranslation([0,0.5/2,3/2-3]); //0.5/2 subir metade da altura do benchseat, 3/2= distancia/2
                    benchSeat();
                popMatrix();
                pushMatrix();
                    multRotationZ(-90);
                    multTranslation([-3/2, 3/2 + 0.5/2,-1]) //x = -3/2+0.5/2, y = width/2 + altura/2 do benchBackrest para posicionar + translaçao y do banco, z = translaçao z do banco
                    benchBackrest();
                popMatrix();
            popMatrix();
        

        //building
            pushMatrix();
                multTranslation([0, 20 / 2, -52]); // 20/2=buildingBase height/2 para subir,52=125/2(half Plane)-125/6/2(half buildingbase width)
                pushMatrix();
                   buildingBase();
                popMatrix();

                
                pushMatrix();
                   multTranslation([0,10,0]);
                   multRotationX(45);
                   baseRoof();
                popMatrix();

                pushMatrix();
                   multTranslation([75/2,0,125/12]);
                   corner();
                popMatrix();

                pushMatrix();
                   multTranslation([-75/2,0,125/12]);
                   corner();
                popMatrix();
                
                //windows base FRONT LEFT  side UP
                pushMatrix();
                   multTranslation([-25/2 - 20/12 - 2 ,20/3,125/12 -0.2]);
                   window1();
                popMatrix();

                pushMatrix();
                   multTranslation([-25/2 - 20/12 - 7,20/3,125/12 -0.2]);
                   window1();
                popMatrix();

                pushMatrix();
                   multTranslation([-25/2 - 20/12 - 12,20/3,125/12 -0.2]);
                   window1();
                popMatrix();
                
                pushMatrix();
                   multTranslation([-25/2 - 20/12 - 17,20/3,125/12 -0.2]);
                   window1();
                popMatrix();

               //windows base FRONT LEFT side DOWN
                pushMatrix();
                   multTranslation([-25/2 - 20/12 - 2 ,-2,125/12 -0.2]);
                   window1();
                popMatrix();

                pushMatrix();
                   multTranslation([-25/2 - 20/12 - 7,-2,125/12 -0.2]);
                   window1();
                popMatrix();

                pushMatrix();
                   multTranslation([-25/2 - 20/12 - 12,-2,125/12 -0.2]);
                   window1();
                popMatrix();
                
                pushMatrix();
                   multTranslation([-25/2 - 20/12 - 17,-2,125/12 -0.2]);
                   window1();
                popMatrix();

               //windows base FRONT RIGHT side UP
                pushMatrix();
                   multTranslation([25/2 + 20/12 + 2 ,20/3,125/12 -0.2]);
                   window1();
                popMatrix();

                pushMatrix();
                   multTranslation([25/2 + 20/12 + 7,20/3,125/12 -0.2]);
                   window1();
                popMatrix();

                pushMatrix();
                   multTranslation([25/2 + 20/12 + 12,20/3,125/12 -0.2]);
                   window1();
                popMatrix();
             
                pushMatrix();
                  multTranslation([25/2 + 20/12 + 17,20/3,125/12 -0.2]);
                  window1();
                popMatrix();

                //windows FRONT RIGHT side DOWN
                pushMatrix();
                  multTranslation([25/2 + 20/12 + 2 ,-2,125/12 -0.2]);
                  window1();
                popMatrix();

                pushMatrix();
                  multTranslation([25/2 + 20/12 + 7,-2,125/12 -0.2]);
                  window1();
                popMatrix();

                pushMatrix();
                  multTranslation([25/2 + 20/12 + 12,-2,125/12 -0.2]);
                  window1();
                popMatrix();
             
                pushMatrix();
                  multTranslation([25/2 + 20/12 + 17,-2,125/12 -0.2]);
                  window1();
                popMatrix();

                



               //windows base BEHIND LEFT side UP
                pushMatrix();
                   multTranslation([-25/2 - 20/12 - 2 ,20/3,-125/12 +0.2]);
                   window1();
                popMatrix();

                pushMatrix();
                   multTranslation([-25/2 - 20/12 - 7,20/3,-125/12 +0.2]);
                   window1();
                popMatrix();

                pushMatrix();
                   multTranslation([-25/2 - 20/12 - 12,20/3,-125/12 +0.2]);
                   window1();
                popMatrix();
                
                pushMatrix();
                   multTranslation([-25/2 - 20/12 - 17,20/3,-125/12 +0.2]);
                   window1();
                popMatrix();

               //windows base BEHIND LEFT side DOWN
                pushMatrix();
                   multTranslation([-25/2 - 20/12 - 2 ,-2,-125/12 +0.2]);
                   window1();
                popMatrix();

                pushMatrix();
                   multTranslation([-25/2 - 20/12 - 7,-2,-125/12 +0.2]);
                   window1();
                popMatrix();

                pushMatrix();
                   multTranslation([-25/2 - 20/12 - 12,-2,-125/12 +0.2]);
                   window1();
                popMatrix();
                
                pushMatrix();
                   multTranslation([-25/2 - 20/12 - 17,-2,-125/12 +0.2]);
                   window1();
                popMatrix();

               //windows base BEHIND RIGHT side UP
                pushMatrix();
                   multTranslation([25/2 + 20/12 + 2 ,20/3,-125/12 +0.2]);
                   window1();
                popMatrix();

                pushMatrix();
                   multTranslation([25/2 + 20/12 + 7,20/3,-125/12 +0.2]);
                   window1();
                popMatrix();

                pushMatrix();
                   multTranslation([25/2 + 20/12 + 12,20/3,-125/12 +0.2]);
                   window1();
                popMatrix();
             
                pushMatrix();
                  multTranslation([25/2 + 20/12 + 17,20/3,-125/12 +0.2]);
                  window1();
                popMatrix();

                //windows base BEHIND RIGHT side DOWN
                pushMatrix();
                  multTranslation([25/2 + 20/12 + 2 ,-2,-125/12 +0.2]);
                  window1();
                popMatrix();

                pushMatrix();
                  multTranslation([25/2 + 20/12 + 7,-2,-125/12 +0.2]);
                  window1();
                popMatrix();

                pushMatrix();
                  multTranslation([25/2 + 20/12 + 12,-2,-125/12 +0.2]);
                  window1();
                popMatrix();
             
                pushMatrix();
                  multTranslation([25/2 + 20/12 + 17,-2,-125/12 +0.2]);
                  window1();
                popMatrix();




                
            popMatrix();

            pushMatrix();
                multTranslation([0, 20 / 2, -50]); // 40/2=buildingBase height/2 para subir,50=125/2(half Plane)-25/2(half buildingCenter width)
                pushMatrix();
                    buildingCenter();
                popMatrix(); 
                multTranslation([0,20/2,0]); 
                    multRotationZ(45); 
                     
                    pushMatrix();
                        centerRoof();
                    popMatrix();
            popMatrix();




            pushMatrix();
                multTranslation([0, 20 / 2, -125 / 2 + 25]); //12.5/2=buildingBase height/2 para subir, 125/2+25=halfPlane + WORLD_SCALE/2
                buildingEntrance();
            popMatrix();

            pushMatrix();
                multTranslation([0, 12.5 / 6, -125 / 2 + 25 + 5/2 -0.4 ]);
                //12/5/6 = Doors halfheight, -125/2(halfPLANE) + 25(buildingCenter width) + 5/2(half buildingEntrance width) -0.4 (halfdoors width -0.1)
                buildingDoors();
            popMatrix();  

            pushMatrix();
                multTranslation([25 / 2,20 / 2,-125 / 2 + 25 + 12.5 / 2 + 1.5]);
                pushMatrix();
                    buildingPilar();
                popMatrix();

                pushMatrix();
                    multTranslation([-7.5,0,0]);
                    buildingPilar();
                popMatrix();

                 pushMatrix();
                    multTranslation([-10-7.5,0,0]);
                    buildingPilar();
                popMatrix();

                
                pushMatrix();
                    multTranslation([-7.5-10-7.5,0,0]);
                    buildingPilar();
                popMatrix();
                multTranslation([-12.5,20/2-3/2+0.1,-2.9]);
                    pushMatrix(); 
                        entranceRoof();
                    popMatrix();
                    
            popMatrix();


            //trees
            pushMatrix();
                multTranslation([50,5/2,25]); // 5/2=halfTrunk height, outros valores sao random
                pushMatrix();
                    treeTrunk1();
                popMatrix();
                multTranslation([0,7/2,0]); // 7/2=halfLeaves height
                pushMatrix();
                    treeLeaves1();
                popMatrix();
            popMatrix();


            pushMatrix();
                multTranslation([-40,5/2,-30]); //5/2=halfTrunk height, outros valores sao random
                pushMatrix();
                    treeTrunk2();
                popMatrix();
                multTranslation([0,7/2,0]); //7/2=halfLeaves height
                pushMatrix();
                    treeLeaves2();
                popMatrix();
            popMatrix();

    
            pushMatrix();
                multTranslation([-60,9/2,0]); //valores random, exceto 9/2=halfTrunk height
                pushMatrix();
                    pineTrunk();
                popMatrix();
                multTranslation([0,20/2+9/2-0.1,0]);
                //20/2(half leavesHeight) + 9/2(HalfTrunk height) -0.1(para o tronco ficar um pouco dentro das folhas)
                pushMatrix();
                    pineLeaves();
                popMatrix();
            popMatrix();

        popMatrix();

   
        


        //Helicopter
        pushMatrix();         
            multRotationY(movement); // movimento em torno de y do helicoptero
            multTranslation([30,0.0,0.0]); // translaçao do helicoptero (o raio é 30)
            //                                              0.5                          3                             0.5             
            multTranslation([0,4+height,0.0]); //4 = ((yPlano/2) + (0.4*translaçao em y de landing gear) + (0.4*yLandingGear/2))
            multRotationY(-90);
            multRotationZ(inclination);
            mModelPoint();          // Updates current position
            multScale([0.4,0.4,0.4]);
            buildHelicopter();
            
        popMatrix();

        //Created boxes
        Boxes();
    }


    function render(timeRender) {
        if (typeof lastTime == undefined) 
            lastTime = timeRender/1000;
        
        lastMovement = movement;
        time = timeRender/1000;
        let dt = time - lastTime;

        window.requestAnimationFrame(render);  

        // To execute commands of pressed keys
        for (let k in keysPressed) {
            if (keysPressed[k]) {   // Key is pressed
                switch (k) {
                    case 'w':
                        mode = gl.LINES;
                        break;
                    case 's':
                        mode = gl.TRIANGLES;
                        break;
                    case 'ArrowUp':
                        //fazer com que so levante voo apos rodar as helices com uma certa velocidade
                        if (height < MAX_HEIGHT) {
                            height += 0.25;
                        }
                        break;
                    case 'ArrowDown':
                        if (height > 0) {
                            height -= 0.25;
                        }
                        break;
                    case 'ArrowLeft':
                        if (height > 0) {
                            movement += speed*dt;      // move the helicopter with a certain speed
                            if (speed < MAX_SPEED)
                                speed += dt*HELICOPTER_ACCELERATION;
                            if (inclination < MAX_INCLINATION)
                                inclination += HELICOPTER_INCLINATION;
                        }
                        break;
                    case '1':
                        // Axonometric
                        view = AXONOMETRIC;
                        break;
                    case '2':
                        // Front view
                        view = FRONT;
                        break;
                    case '3':
                        // Top view
                        view = TOP;
                        break;
                    case '4':
                        // Right view
                        view = RIGHT;
                        break;
                    case '5':       
                        //at: newPosFront = mult(model, vec4(0,0,2,1));
                        view = HELICOPTER;
                        break;
                }
            }
            else //Key is not pressed
                /*
                 * If ArrowLeft is being pressed and the helicopter descends to ground level 
                 * the landing will be adjusted as well
                */
                if (k == 'ArrowLeft' || height == 0) {
                    if (speed * dt > 0) {
                        speed -= HELICOPTER_ACCELERATION*dt;
                        lastMovement = movement;
                        movement += speed*dt;
                    }

                    if (inclination > 0)
                        inclination -= HELICOPTER_INCLINATION;
                }

        }             

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(program);

        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));

        switch (view) {
            case AXONOMETRIC:
                //mView = mult(rotateY(objectProps.theta),mult(rotateX(objectProps.gamma), lookAt([0, 0, 1], [0, 0, 0], [0, 1, 0])));
                mView = mult(lookAt([0, 0, 1], [0, 0, 0], [0, 1, 0]),mult(rotateX(objectProps.gamma), rotateY(objectProps.theta) ));
                break;
            case FRONT:
                mView = lookAt([0, 0, 1], [0, 0, 0], [0, 1, 0]);
                break;
            case TOP:
                mView = lookAt([0, 1, 0], [0, 0, 0], [0, 0, -1]);
                break;
            case RIGHT:
                mView = lookAt([1, 0, 0], [0, 0, 0], [0, 1, 0]);
                break;
            case HELICOPTER:
                //at: newPosFront = mult(model, vec4(0,0,2,1));       
                mView = lookAt([position[0],position[1],position[2]],[front[0],front[1], front[2]], [0, 1, 0]);
                break;
        }

        loadMatrix(mView);

        World();

        lastTime = time;
        let movementAngle = Math.abs(lastMovement-movement);
        normaVelocidade= Math.tan(movementAngle*Math.PI/180)*30;
        //console.log(Math.tan(movementAngle*Math.PI/180));
    }
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))