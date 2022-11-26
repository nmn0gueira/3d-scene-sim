import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { ortho, lookAt, flatten, vec4, inverse, mult, rotateX, rotateY, subtract, normalize, scalem } from "../../libs/MV.js";
import { modelView, loadMatrix, multRotationX, multRotationZ, multRotationY, multScale, multTranslation, pushMatrix, popMatrix } from "../../libs/stack.js";

import * as SPHERE from '../../libs/objects/sphere.js';
import * as CUBE from '../../libs/objects/cube.js'
import * as CYLINDER from '../../libs/objects/cylinder.js'
import * as TORUS from '../../libs/objects/torus.js'
import * as PYRAMID from '../../libs/objects/pyramid.js'
import { GUI } from "../libs/dat.gui.module.js";


/** @type WebGLRenderingContext */
let gl;

// Transformation (only values that are independent)
// Helicopter
const X_SCALE = 0.4;
const Y_SCALE = 0.4;
const Z_SCALE = 0.4;


const X_BODY = 20;
const Y_BODY = 10;
const Z_BODY = 10;

const X_ROTOR = 2;
const Y_ROTOR = 5;
const Z_ROTOR = 2;

const X_HELIX = 12.5/2;
const Y_HELIX = 1;
const Z_HELIX = 2.5;

const X_SUPPORT_LEG = 1.5;
const Y_SUPPORT_LEG = 5;
const Z_SUPPORT_LEG = 1.5;

const X_LANDING_GEAR = 2.5;
const Y_LANDING_GEAR = 20;
const Z_LANDING_GEAR = 2.5;

// Box
const X_BOX = 3;
const Y_BOX = 3;
const Z_BOX = 3;

// Plane
const X_PLANE = 150;
const Y_PLANE = 1;
const Z_PLANE = 150;

// World Physics
const WORLD_SCALE = 50; 
const RADIUS = 30;
const EARTH_GRAVITY = 9.8;
const MAX_HEIGHT = 30;
const MAX_ANGULAR_VELOCITY = 120;
const MAX_INCLINATION = 30;
const ANGULAR_ACCELERATION = 120;        // in approximately 1 second of moving the helicopter is at max speed
const HELICOPTER_INCLINATION = 30;          // in approximately 1 second of moving the helicopter is at max inclination
const MAX_HELIX_ANGULAR_VELOCITY = 360*2;
const HELIX_ANGULAR_ACCELERATION = 360*2;   // in approximately 1 second the helices rotate with max angular velocity


// Views
const AXONOMETRIC = "Axonometric";
const FRONT = "Front";
const TOP = "Top";
const RIGHT = "Right";
const HELICOPTER = "Helicopter";

//Additional
let helicopterOnly = {mode:false}; 


let time = 0;           // Global simulation time in seconds
let lastTime = 0;       // Last animation time
let dt = 0;             // Time between this animation call and last
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let objectProps = {gamma:0, theta:0};
let view = AXONOMETRIC; // the program starts with axonometric projection
let keysPressed = [];

//Helicopter related
let rotation = 0;                // Y axis rotation in relation to the center of the world
let angularVelocity = 0;         // Rate of velocity at which the helicopter is rotating around the Y axis
let helixRotation = 0;
let helixAngularVelocity = 0;    // Only used for the helices
let height = 0;                  // Current height the helicopter is at
let lastMovement= 0;
let inclination = 0;    // X axis rotation on the helicopter
let position;           // World coordinates of the helicopter
let front;              // World coordinates of a position directly in front of the helicopter
let boxes = [];         // Boxes the helicopter drops

let velocityDirection;   // Vector with the direction the helicopter is moving
let linearVelocity = 0;


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
    gui.add(helicopterOnly, "mode").name("Helicopter Only");
    //gui.add(angularVelocity);

    resize_canvas();
    window.addEventListener("resize", resize_canvas);

    document.onkeydown = onkeyup = function (event) {
        const type = event.type == 'keydown';
        keysPressed[event.key] = type;  
        
        // Space can be pressed for a single box or held for multiple boxes
        if (type && event.key == " " && height > 0) {
            //var toPush = boxes.length % 2 == 0 ? position : front;
            boxes.push({ time: time, velocity: [velocityDirection[0]*linearVelocity,0, velocityDirection[2]*linearVelocity], point: position});
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

        const uColor = gl.getUniformLocation(program, "uColor");

        gl.uniform4fv(uColor, color);
    }

    function buildHelicopterMainBody() {

        multScale([X_BODY, Y_BODY, Z_BODY]);

        let color = [236/255,41/255,57/255,1.0];  // Imperial Red 237, 41, 57
        setColor(color); 

        uploadModelView();

        SPHERE.draw(gl, program, mode);

    }

    function HelicopterTail() {
        pushMatrix();
            buildHelicopterTail1();
        popMatrix();
        multTranslation([X_BODY*5/8, Y_BODY/2, 0]);
        multRotationZ(70);  
        pushMatrix();
            buildHelicopterTail2();
        popMatrix();
        multRotationX(90);
        TailRotorSystem();
    }

    function HelicopterUpperRotor() {
        //Helix holder
        pushMatrix();
            buildRotor();
        popMatrix();
        multRotationY(helixRotation);
        //Helix 1
        pushMatrix();
            multTranslation([X_BODY*5/8, Y_ROTOR / 4, 0]); 
            multScale([4,1,1]);                // four times larger in x than tail helices
            buildHelix();
        popMatrix();
        //Helix 2
        pushMatrix();
            multRotationY(120);    
            multTranslation([X_BODY*5/8, Y_ROTOR / 4, 0]); 
            multScale([4,1,1]);
            buildHelix();
        popMatrix();
        //Helix 3
        multRotationY(240);
        multTranslation([X_BODY*5/8, Y_ROTOR / 4, 0]);
        multScale([4,1,1]);
        buildHelix();
    }

    function HelicopterLowerBody() {
        //Support 1
        pushMatrix();    
            multTranslation([-X_BODY*3/10, -Y_BODY/2, Z_BODY*2/5]);   
            multRotationX(150); 
            multRotationZ(15); 
            buildSupportLeg();
        popMatrix();
        //Support 2
        pushMatrix();
            multTranslation([X_BODY*3/10,-Y_BODY/2, Z_BODY*2/5]);     
            multRotationX(150);
            multRotationZ(-15); 
            buildSupportLeg();
        popMatrix();
        //Support 3
        pushMatrix();
            multTranslation([X_BODY*3/10,-Y_BODY/2,-Z_BODY*2/5]); 
            multRotationX(-150);
            multRotationZ(-15); 
            buildSupportLeg();
        popMatrix();
        //Support 4
        pushMatrix();
            multTranslation([-X_BODY*3/10,-Y_BODY/2,-Z_BODY*2/5]);
            multRotationX(-150);
            multRotationZ(15); 
            buildSupportLeg();
        popMatrix();

        //Landing gear 1
        pushMatrix();
            multTranslation([0,-Y_BODY*3/4,Z_BODY/2]); 
            multRotationZ(90);
            buildLandingGear();
        popMatrix();
        //Landing gear 2
        multTranslation([0,-Y_BODY*3/4,-Z_BODY/2]); 
        multRotationZ(90);
        buildLandingGear();
    }

    function buildHelicopterTail1() {

        multScale([X_BODY*5/4, Y_BODY/2, Z_BODY/2]);  // 25 = xBody+xBody/4, 5 = yBody/2, 5 = zBody/2

        uploadModelView();

        SPHERE.draw(gl, program, mode);

    }

    function buildHelicopterTail2() {

        multScale([X_BODY*5/8, Y_BODY/2, Z_BODY/2]);  //12.5 = xTail1/2, 5 = yTail1, 5 = zTail1

        uploadModelView();

        SPHERE.draw(gl, program, mode);

    }

    function TailRotorSystem() {
        pushMatrix();
            multTranslation([0,Y_ROTOR/4,0]);
            buildRotor();
        popMatrix();
        multRotationY(helixRotation);
        pushMatrix();
            multTranslation([X_ROTOR*2, Y_ROTOR/2+Y_ROTOR/8, 0]); 
            buildHelix();
        popMatrix();
        multRotationY(180);
        multTranslation([X_ROTOR*2, Y_ROTOR/2+Y_ROTOR/8, 0]);
    }

    function buildRotor() {
        multScale([X_ROTOR, Y_ROTOR, Z_ROTOR]);

        let color = [240/255,240/255,237/255,1.0]; // Light white
        setColor(color); 

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
    }

    function buildHelix() {
        multScale([X_HELIX, Y_HELIX, Z_HELIX]); 

        let color = [27/255,30/255,35/255,1.0]; // Black
        setColor(color);

        uploadModelView();

        SPHERE.draw(gl, program, mode);
     }

    function buildSupportLeg() {
        multScale([X_SUPPORT_LEG, Y_SUPPORT_LEG, Z_SUPPORT_LEG]);

        let color = [246/255,190/255,0.0,1.0]; // Gold Yellow
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);
    }

    function buildLandingGear() {
        multScale([X_LANDING_GEAR, Y_LANDING_GEAR, Z_LANDING_GEAR]);

        let color = [240/255,240/255,237/255,1.0]; // Light white
        
        setColor(color);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
    }

    function Helicopter() {
        pushMatrix();
            buildHelicopterMainBody();
        popMatrix();
        pushMatrix();
            multTranslation([X_BODY*3/4, Y_BODY/5, 0]);
            HelicopterTail();
        popMatrix();

        pushMatrix();
            multTranslation([0, Y_BODY/2, 0]); 
            HelicopterUpperRotor();
        popMatrix();

        HelicopterLowerBody();
    }

    function Plane() {
        multScale([X_PLANE,Y_PLANE,Z_PLANE]);

        let color = [68/255,88/255,15/255,1.0];   // Grass Green
        
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);
    }

    function box() {
        multScale([X_BOX,Y_BOX,Z_BOX]); 

        let color = [0.66,0.41,0.28,1.0]; // Brown
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);
        
    }

    // Used only right before drawing the helicopter
    function updatePositionsAndVelocity() {
        const mModel = mult(inverse(mView), modelView());
        
        position = mult(mModel, vec4(0.0,0.0,0,1.0));

        front = mult(mModel, vec4(-1.0,0.0,0,1.0));

        velocityDirection = normalize(subtract(front,position));
    }


    function Boxes() {
        for (const b of boxes) {
            if (time - b.time < 5) {
                pushMatrix();
                    //b.point[1] is the height at which the box was dropped
                    multTranslation([b.point[0],b.point[1],b.point[2]]);          
                    //2 = (yBox/2+yPlane/2)
                    if (b.point[1]-(Y_BOX/2+Y_PLANE/2) > 0) { // Box has not hit the ground
                        const timeFactor = dt;
                        b.point[0] = b.point[0] + b.velocity[0]*timeFactor;

                        //If box hits the ground or goes under it, set y position at 2 (ground level)
                        b.point[1] = b.point[1] - b.velocity[1]*timeFactor <= Y_BOX/2+Y_PLANE/2 ? Y_BOX/2+Y_PLANE/2 : b.point[1] - b.velocity[1]*timeFactor;

                        b.point[2] = b.point[2] + b.velocity[2]*timeFactor;

                        console.log(Y_BOX/2+Y_PLANE/2);
                        
                        /* IF YOU DECIDE TO SET timeFactor TO 1 TO NOTICE THE VELOCITY IN x AND z
                        *  USE EARTH_GRAVITY/1000 FOR EXAMPLE
                        */
                        b.velocity[1] = b.velocity[1] + EARTH_GRAVITY*timeFactor;
                    }
                    box();
                popMatrix();
            }
            //If a box has existed for more than 5 seconds it disappears
            else 
                boxes.shift();  // FIFO The box to disappear will always be the earliest dropped
        } 
    }




    function buildPond(){
        multScale([20,1,20]);  // 20 = xLakeHolder*4/5, 20 = zLakeHolder*4/5
    
        let color = [68/255,187/255,1.0,1.0];    //(68,187,255)
        
        setColor(color);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);
        

    }
    
    function buildPondLimit(){
        multScale([25,7.5,25]);  // 25 = WORLD_SCALE/2, 

        let color = [0.57,0.56,0.56,1.0]; // 145, 142, 133 Stone
        
        setColor(color);

        uploadModelView();

        TORUS.draw(gl, program, mode);

    }

    function buildCircularPavement(){
        multScale([50,1,50]);  // 50 = WORLD_SCALE, 1 para ter alguma grossura
    
        
        let color = [0.78,0.78,0.78,1.0]; 
        
        setColor(color);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);

    }

    function buildPavement(){
        multScale([25,1,150]);  // 150 = plane size, 25=xPLANE/6

        let color = [0.78,0.78,0.78,1.0]; 
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);

    }

    function table(){
        multScale([8,0.5,13]); //random values

        let color = [0.4,0.48,0.48,1.0]; 
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);
    }

    function tableLeg(){
        multScale([3,3,0.5]); //random values
        
        let color = [0.78,0.78,0.78,1.0]; 
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);
    }

    function tableBench(){
        multScale([3,0.5,11]); //random values
        
        let color = [0.78,0.78,0.78,1.0]; 
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);
    }

    function tableBenchLeg(){
        multScale([0.5,1,6]);//random values
        
        let color = [0.78,0.78,0.78,1.0]; 
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);
    }



//bench
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
        let color = [0.24,0.05,0.08,1.0]; 
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);
    }


    function benchBackrest(){
        multScale([3,0.5,6]); //mesmos tamanhos que o benchSeat

        let color = [0.39,0.05,0.08,1.0]; 
        
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

    function buildNormalWindow(){
        multScale([20/6,20/6,0.5]);  

        let color = [104/255,200/255,230/255,1.0]; // 104,200,230
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);
    }

    function buildSmallWindow(){
        multScale([20/12,20/12,0.5]);  

        let color = [104/255,200/255,230/255,1.0]; 
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);
    }

    function buildRoofWindow(){
            multScale([4,0.5,4]);  
    
            let color = [104/255,200/255,230/255,1.0]; 
            
            setColor(color);
    
            uploadModelView();
    
            CYLINDER.draw(gl, program, mode);
        

    }

    function buildRoofWindowLimit(){
        multScale([5,4,5]);  
    
            let color = [0.0,0.0,0.0,1.0]; 
            
            setColor(color);
    
            uploadModelView();
    
            TORUS.draw(gl, program, mode);

    }

    function baseRoof(){
        multScale([75-0.1,14.7,14.7]);  //75=~ 2*125/3, 20 valor escolhido para altura, 125/6= para ter 1/6 do PLane

        let color = [0.94,0.21,0.03,1.0]; 
        
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

    
    function buildCenterBuilding(){

        multScale([125/5,20,25]);  // 125/5= para ter 1/5 do tamanho do PLANE, 20 valor escolhido para altura  , 25= WORLD_SCALE/2

        let color = [0.98,0.68,0.38,1.0]; 
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);

    }

    function buildCenterRoof(){
        multScale([17.7,17.7,125/5-0.2]); // 40=building center height

        let color = [0.94,0.21,0.03,1.0]; 
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode); 
    }


    function buildEntrance(){
        
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

    function entranceRoof(){
        multScale([25 + 3,3,10]); // 40=building center height

        let color = [0.77,0.77,0.77,1.0]; 
        
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

     function treeTrunk3(){
        multScale([3,11,3]);  // random

        let color = [0.52,0.24,0.01,1.0]; 
        
        setColor(color);

        uploadModelView();

        CYLINDER.draw(gl, program, mode);

     }

     function treeLeaves3(){
        multScale([10,7,10]);  // random

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

    function PondAndPavement() {
        multTranslation([0,1,0]);  // 1 = yPlane
        pushMatrix();
            buildPond();
        popMatrix();
        pushMatrix();
            buildPondLimit();
        popMatrix();
        pushMatrix();
            multTranslation([0,-0.75,0]);     // 0.75 = yPlane - 0.25
            buildCircularPavement();
        popMatrix();
        multTranslation([0,-0.75,0]);     // 0.25 = yPlane/4
        buildPavement();
    
    }

    function Benches() {
        //Bench 1
        multTranslation([25/2+1,0.5,50]); //6= 5(circularpavement WIDTH/2) + 1(benchleg LENGTH/2), 0.5 = yPlane/2
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
            multTranslation([-3/2, 3/2 + 0.5/2,-1.5]) //x = -3/2+0.5/2, y = width/2 + altura/2 do benchBackrest para posicionar + translaçao y do banco, z = translaçao z do banco
            benchBackrest();
        popMatrix();

        //Bench 2
        multTranslation([-26-1,0,0]); //6= 5(circularpavement WIDTH/2) + 1(benchleg LENGTH/2) 
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
            multRotationZ(-90);
            multTranslation([-3/2, -3/2 - 0.5/2,-1.5]) //x = -3/2+0.5/2, y = width/2 + altura/2 do benchBackrest para posicionar + translaçao y do banco, z = translaçao z do banco
            benchBackrest();
    }

    function Tables() {
        //Table1
        multTranslation([60,2.5,30]);
        pushMatrix();
            table(); 
        popMatrix();
            
        pushMatrix();
            multTranslation([0,-1.3,0]);
            tableLeg();
        popMatrix();

        pushMatrix();
            multTranslation([0,-1.3,0]);
            multRotationY(90);
            tableLeg();
        popMatrix();

        pushMatrix();
            multTranslation([4,-1,0]);
            tableBench();
        popMatrix();

        pushMatrix();
            multTranslation([4,-1.5,0]);
            tableBenchLeg();
        popMatrix();

        pushMatrix();
            multTranslation([-4,-1,0]);
            tableBench();
        popMatrix();

        pushMatrix();
            multTranslation([-4,-1.5,0]);
            tableBenchLeg();
        popMatrix();

        //Table2
        pushMatrix();
            multTranslation([-12.5,0,30]);   
            pushMatrix();
                table(); 
            popMatrix();
       
            pushMatrix();
                multTranslation([0,-1.3,0]);
                tableLeg();
            popMatrix();

            pushMatrix();
               multTranslation([0,-1.3,0]);
               multRotationY(90);
               tableLeg();
            popMatrix();

            pushMatrix();
                multTranslation([4,-1,0]);
                tableBench();
            popMatrix();

            pushMatrix();
                multTranslation([4,-1.5,0]);
                tableBenchLeg();
            popMatrix();

            pushMatrix();
                multTranslation([-4,-1,0]);
                tableBench();
            popMatrix();
            multTranslation([-4,-1.5,0]);
            tableBenchLeg();
        popMatrix();

        //Table3
        multTranslation([-25,0,0]);    
        pushMatrix();
            table(); 
        popMatrix();
            
        pushMatrix();
            multTranslation([0,-1.3,0]);
            tableLeg();
        popMatrix();

        pushMatrix();
            multTranslation([0,-1.3,0]);
            multRotationY(90);
            tableLeg();
        popMatrix();

        pushMatrix();
            multTranslation([4,-1,0]);
            tableBench();
        popMatrix();

        pushMatrix();
            multTranslation([4,-1.5,0]);
            tableBenchLeg();
        popMatrix();

        pushMatrix();
            multTranslation([-4,-1,0]);
            tableBench();
        popMatrix();

        multTranslation([-4,-1.5,0]);
        tableBenchLeg();

    }

    function NormalWindows() {
        //windows base FRONT LEFT  side UP
        pushMatrix();
        multTranslation([-25/2 - 20/12 - 2 ,20/3,125/12 -0.2]);
        buildNormalWindow();
     popMatrix();

     pushMatrix();
        multTranslation([-25/2 - 20/12 - 7,20/3,125/12 -0.2]);
        buildNormalWindow();
     popMatrix();

     pushMatrix();
        multTranslation([-25/2 - 20/12 - 12,20/3,125/12 -0.2]);
        buildNormalWindow();
     popMatrix();
     
     pushMatrix();
        multTranslation([-25/2 - 20/12 - 17,20/3,125/12 -0.2]);
        buildNormalWindow();
     popMatrix();

    //windows base FRONT LEFT side DOWN
     pushMatrix();
        multTranslation([-25/2 - 20/12 - 2 ,-2,125/12 -0.2]);
        buildNormalWindow();
     popMatrix();

     pushMatrix();
        multTranslation([-25/2 - 20/12 - 7,-2,125/12 -0.2]);
        buildNormalWindow();
     popMatrix();

     pushMatrix();
        multTranslation([-25/2 - 20/12 - 12,-2,125/12 -0.2]);
        buildNormalWindow();
     popMatrix();
     
     pushMatrix();
        multTranslation([-25/2 - 20/12 - 17,-2,125/12 -0.2]);
        buildNormalWindow();
     popMatrix();

    //windows base FRONT RIGHT side UP
     pushMatrix();
        multTranslation([25/2 + 20/12 + 2 ,20/3,125/12 -0.2]);
        buildNormalWindow();
     popMatrix();

     pushMatrix();
        multTranslation([25/2 + 20/12 + 7,20/3,125/12 -0.2]);
        buildNormalWindow();
     popMatrix();

     pushMatrix();
        multTranslation([25/2 + 20/12 + 12,20/3,125/12 -0.2]);
        buildNormalWindow();
     popMatrix();
  
     pushMatrix();
       multTranslation([25/2 + 20/12 + 17,20/3,125/12 -0.2]);
       buildNormalWindow();
     popMatrix();

     //windows FRONT RIGHT side DOWN
     pushMatrix();
       multTranslation([25/2 + 20/12 + 2 ,-2,125/12 -0.2]);
       buildNormalWindow();
     popMatrix();

     pushMatrix();
       multTranslation([25/2 + 20/12 + 7,-2,125/12 -0.2]);
       buildNormalWindow();
     popMatrix();

     pushMatrix();
       multTranslation([25/2 + 20/12 + 12,-2,125/12 -0.2]);
       buildNormalWindow();
     popMatrix();
  
     pushMatrix();
       multTranslation([25/2 + 20/12 + 17,-2,125/12 -0.2]);
       buildNormalWindow();
     popMatrix();

    //windows base BEHIND LEFT side UP
     pushMatrix();
        multTranslation([-25/2 - 20/12 - 2 ,20/3,-125/12 +0.2]);
        buildNormalWindow();
     popMatrix();

     pushMatrix();
        multTranslation([-25/2 - 20/12 - 7,20/3,-125/12 +0.2]);
        buildNormalWindow();
     popMatrix();

     pushMatrix();
        multTranslation([-25/2 - 20/12 - 12,20/3,-125/12 +0.2]);
        buildNormalWindow();
     popMatrix();
     
     pushMatrix();
        multTranslation([-25/2 - 20/12 - 17,20/3,-125/12 +0.2]);
        buildNormalWindow();
     popMatrix();

    //windows base BEHIND LEFT side DOWN
     pushMatrix();
        multTranslation([-25/2 - 20/12 - 2 ,-2,-125/12 +0.2]);
        buildNormalWindow();
     popMatrix();

     pushMatrix();
        multTranslation([-25/2 - 20/12 - 7,-2,-125/12 +0.2]);
        buildNormalWindow();
     popMatrix();

     pushMatrix();
        multTranslation([-25/2 - 20/12 - 12,-2,-125/12 +0.2]);
        buildNormalWindow();
     popMatrix();
     
     pushMatrix();
        multTranslation([-25/2 - 20/12 - 17,-2,-125/12 +0.2]);
        buildNormalWindow();
     popMatrix();

    //windows base BEHIND RIGHT side UP
     pushMatrix();
        multTranslation([25/2 + 20/12 + 2 ,20/3,-125/12 +0.2]);
        buildNormalWindow();
     popMatrix();

     pushMatrix();
        multTranslation([25/2 + 20/12 + 7,20/3,-125/12 +0.2]);
        buildNormalWindow();
     popMatrix();

     pushMatrix();
        multTranslation([25/2 + 20/12 + 12,20/3,-125/12 +0.2]);
        buildNormalWindow();
     popMatrix();
  
     pushMatrix();
       multTranslation([25/2 + 20/12 + 17,20/3,-125/12 +0.2]);
       buildNormalWindow();
     popMatrix();

     //windows base BEHIND RIGHT side DOWN
     pushMatrix();
       multTranslation([25/2 + 20/12 + 2 ,-2,-125/12 +0.2]);
       buildNormalWindow();
     popMatrix();

     pushMatrix();
       multTranslation([25/2 + 20/12 + 7,-2,-125/12 +0.2]);
       buildNormalWindow();
     popMatrix();

     pushMatrix();
       multTranslation([25/2 + 20/12 + 12,-2,-125/12 +0.2]);
       buildNormalWindow();
     popMatrix();
  
     pushMatrix();
       multTranslation([25/2 + 20/12 + 17,-2,-125/12 +0.2]);
       buildNormalWindow();
     popMatrix();


     //windows LEFT side 

     pushMatrix();
       multTranslation([-75/2+0.2,20/3,-125/12+5]);
       multRotationY(90);
       buildNormalWindow();
     popMatrix();

     pushMatrix();
       multTranslation([-75/2+0.2,20/3,-125/12+10]);
       multRotationY(90);
       buildNormalWindow();
     popMatrix();

     pushMatrix();
       multTranslation([-75/2+0.2,20/3,-125/12+15]);
       multRotationY(90);
       buildNormalWindow();
     popMatrix();
    //windows LEFT side DOWN
     pushMatrix();
       multTranslation([-75/2+0.2,-2,-125/12+5]);
       multRotationY(90);
       buildNormalWindow();
     popMatrix();

     pushMatrix();
       multTranslation([-75/2+0.2,-2,-125/12+10]);
       multRotationY(90);
       buildNormalWindow();
     popMatrix();

     pushMatrix();
       multTranslation([-75/2+0.2,-2,-125/12+15]);
       multRotationY(90);
       buildNormalWindow();
     popMatrix();




     //windows RIGHT side UP

     pushMatrix();
       multTranslation([75/2-0.2,20/3,-125/12+5]);
       multRotationY(90);
       buildNormalWindow();
     popMatrix();

     pushMatrix();
       multTranslation([75/2-0.2,20/3,-125/12+10]);
       multRotationY(90);
       buildNormalWindow();
     popMatrix();

     pushMatrix();
       multTranslation([75/2-0.2,20/3,-125/12+15]);
       multRotationY(90);
       buildNormalWindow();
     popMatrix();

        //windows RIGHT side DOWN
        pushMatrix();
            multTranslation([75/2-0.2,-2,-125/12+5]);
            multRotationY(90);
            buildNormalWindow();
        popMatrix();

        pushMatrix();
            multTranslation([75/2-0.2,-2,-125/12+10]);
            multRotationY(90);
            buildNormalWindow();
        popMatrix();

        multTranslation([75/2-0.2,-2,-125/12+15]);
        multRotationY(90);
        buildNormalWindow();

    }

    function SmallWindows() {
        //CENTER windows FRONT
            //right
        pushMatrix();
            multTranslation([125 / 10 - 25 / 8, 20 / 4, 25 / 2 + 1.5 - 0.2])
            buildSmallWindow();
        popMatrix();

        pushMatrix();
            multTranslation([125 / 10 - (2 * 25) / 8, 20 / 4, 25 / 2 + 1.5 - 0.2])
            buildSmallWindow();
        popMatrix();

        pushMatrix();
            multTranslation([125 / 10 - (3 * 25) / 8, 20 / 4, 25 / 2 + 1.5 - 0.2])
            buildSmallWindow();
        popMatrix();

        //center
        pushMatrix();
            multTranslation([125 / 10 - (4 * 25) / 8, 20 / 4, 25 / 2 + 1.5 - 0.2])
            buildSmallWindow();
        popMatrix();

        //left
        pushMatrix();
        multTranslation([-125 / 10 + 25 / 8, 20 / 4, 25 / 2 + 1.5 - 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([-125 / 10 + (2 * 25) / 8, 20 / 4, 25 / 2 + 1.5 - 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([-125 / 10 + (3 * 25) / 8, 20 / 4, 25 / 2 + 1.5 - 0.2])
        buildSmallWindow();
        popMatrix();


        //second Row
        //right
        pushMatrix();
        multTranslation([125 / 10 - 25 / 8, 20 / 4 - 4, 25 / 2 + 1.5 - 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([125 / 10 - (2 * 25) / 8, 20 / 4 - 4, 25 / 2 + 1.5 - 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([125 / 10 - (3 * 25) / 8, 20 / 4 - 4, 25 / 2 + 1.5 - 0.2])
        buildSmallWindow();
        popMatrix();

        //center
        pushMatrix();
        multTranslation([125 / 10 - (4 * 25) / 8, 20 / 4 - 4, 25 / 2 + 1.5 - 0.2])
        buildSmallWindow();
        popMatrix();

        //left
        pushMatrix();
        multTranslation([-125 / 10 + 25 / 8, 20 / 4 - 4, 25 / 2 + 1.5 - 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([-125 / 10 + (2 * 25) / 8, 20 / 4 - 4, 25 / 2 + 1.5 - 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([-125 / 10 + (3 * 25) / 8, 20 / 4 - 4, 25 / 2 + 1.5 - 0.2])
        buildSmallWindow();
        popMatrix();


        //third Row
        //right
        pushMatrix();
        multTranslation([125 / 10 - 25 / 8, 20 / 4 - 8, 25 / 2 + 1.5 - 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([125 / 10 - (2 * 25) / 8, 20 / 4 - 8, 25 / 2 + 1.5 - 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([125 / 10 - (3 * 25) / 8, 20 / 4 - 8, 25 / 2 + 1.5 - 0.2])
        buildSmallWindow();
        popMatrix();

        //center
        pushMatrix();
        multTranslation([125 / 10 - (4 * 25) / 8, 20 / 4 - 8, 25 / 2 + 1.5 - 0.2])
        buildSmallWindow();
        popMatrix();

        //left
        pushMatrix();
        multTranslation([-125 / 10 + 25 / 8, 20 / 4 - 8, 25 / 2 + 1.5 - 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([-125 / 10 + (2 * 25) / 8, 20 / 4 - 8, 25 / 2 + 1.5 - 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([-125 / 10 + (3 * 25) / 8, 20 / 4 - 8, 25 / 2 + 1.5 - 0.2])
        buildSmallWindow();
        popMatrix();



        //forth row
        //right
        pushMatrix();
        multTranslation([125 / 10 - 25 / 8, 20 / 4 - 12, 25 / 2 + 1.5 - 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([125 / 10 - (2 * 25) / 8, 20 / 4 - 12, 25 / 2 + 1.5 - 0.2])
        buildSmallWindow();
        popMatrix();

        //left
        pushMatrix();
        multTranslation([-125 / 10 + 25 / 8, 20 / 4 - 12, 25 / 2 + 1.5 - 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([-125 / 10 + (2 * 25) / 8, 20 / 4 - 12, 25 / 2 + 1.5 - 0.2])
        buildSmallWindow();
        popMatrix();



        //CENTER windows BEHIND
        //right
        pushMatrix();
        multTranslation([125 / 10 - 25 / 8, 20 / 4, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([125 / 10 - (2 * 25) / 8, 20 / 4, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([125 / 10 - (3 * 25) / 8, 20 / 4, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();

        //center
        pushMatrix();
        multTranslation([125 / 10 - (4 * 25) / 8, 20 / 4, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();

        //left
        pushMatrix();
        multTranslation([-125 / 10 + 25 / 8, 20 / 4, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([-125 / 10 + (2 * 25) / 8, 20 / 4, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([-125 / 10 + (3 * 25) / 8, 20 / 4, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();


        //second Row
        //right
        pushMatrix();
        multTranslation([125 / 10 - 25 / 8, 20 / 4 - 4, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([125 / 10 - (2 * 25) / 8, 20 / 4 - 4, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([125 / 10 - (3 * 25) / 8, 20 / 4 - 4, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();

        //center
        pushMatrix();
        multTranslation([125 / 10 - (4 * 25) / 8, 20 / 4 - 4, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();

        //left
        pushMatrix();
        multTranslation([-125 / 10 + 25 / 8, 20 / 4 - 4, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([-125 / 10 + (2 * 25) / 8, 20 / 4 - 4, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([-125 / 10 + (3 * 25) / 8, 20 / 4 - 4, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();


        //third Row
        //right
        pushMatrix();
        multTranslation([125 / 10 - 25 / 8, 20 / 4 - 8, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([125 / 10 - (2 * 25) / 8, 20 / 4 - 8, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([125 / 10 - (3 * 25) / 8, 20 / 4 - 8, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();

        //center
        pushMatrix();
        multTranslation([125 / 10 - (4 * 25) / 8, 20 / 4 - 8, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();

        //left
        pushMatrix();
        multTranslation([-125 / 10 + 25 / 8, 20 / 4 - 8, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([-125 / 10 + (2 * 25) / 8, 20 / 4 - 8, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([-125 / 10 + (3 * 25) / 8, 20 / 4 - 8, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();


        //forth row
        //right
        pushMatrix();
        multTranslation([125 / 10 - 25 / 8, 20 / 4 - 12, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([125 / 10 - (2 * 25) / 8, 20 / 4 - 12, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([125 / 10 - (3 * 25) / 8, 20 / 4 - 12, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();

        //center
        pushMatrix();
        multTranslation([125 / 10 - (4 * 25) / 8, 20 / 4 - 12, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();

        //left
        pushMatrix();
        multTranslation([-125 / 10 + 25 / 8, 20 / 4 - 12, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();

        pushMatrix();
        multTranslation([-125 / 10 + (2 * 25) / 8, 20 / 4 - 12, -25 / 2 + 0.2])
        buildSmallWindow();
        popMatrix();

        multTranslation([-125 / 10 + (3 * 25) / 8, 20 / 4 - 12, -25 / 2 + 0.2])
        buildSmallWindow();
    }

    function CenterBuilding() {
        multTranslation([0, 20 / 2, -62.4]); // 40/2=buildingBase height/2 para subir,50=125/2(half Plane)-25/2(half buildingCenter width)
        pushMatrix();
            buildCenterBuilding();
        popMatrix(); 
                
        pushMatrix();
            SmallWindows();
        popMatrix();   
            
        multTranslation([0, 20 / 2, 0]);

        //roof
        pushMatrix();
            multRotationZ(45);
            buildCenterRoof();
        popMatrix();

        multTranslation([0, 17.7 / 4, 125 / 10 - 0.2]);
        multRotationX(90);
        pushMatrix();
            buildRoofWindow();
        popMatrix();
        buildRoofWindowLimit();
    }

    function Entrance() {
        multTranslation([0, 20 / 2, -150 / 2 + 25 - 0.9]);
        pushMatrix();
            buildEntrance();
        popMatrix();

        multTranslation([0, -20 / 2 + 12.5 / 6, 2.5 - 0.4]);
        //12.5/6 = Doors halfheight, -125/2(halfPLANE) + 25(buildingCenter width) + 5/2(half buildingEntrance width) -0.4 (halfdoors width -0.1)
        buildingDoors();
    }

    function PillarsAndEntranceRoof() {
        multTranslation([25 / 2, 20 / 2, -150 / 2 + 25 + 12.5 / 2 + 0.5]);
        pushMatrix();
            buildingPilar();
        popMatrix();

        pushMatrix();
            multTranslation([-7.5, 0, 0]);
            buildingPilar();
        popMatrix();

        pushMatrix();
            multTranslation([-10 - 7.5, 0, 0]);
            buildingPilar();
        popMatrix();


        pushMatrix();
            multTranslation([-7.5 - 10 - 7.5, 0, 0]);
            buildingPilar();
        popMatrix();
        multTranslation([-12.5, 20 / 2 - 3 / 2 + 0.1, -2.9]);
        entranceRoof();
    }

    function Building() {
        multTranslation([0, 20 / 2, -64.4]); // 20/2=buildingBase height/2 para subir,52=150/2(half Plane)-125/6/2(half buildingbase width)
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
                         
        pushMatrix();
            NormalWindows();
        popMatrix();
 
        multTranslation([0,-20/2,64.4]); // Undoes multTranslation([0, 20 / 2, -64.4]);

        pushMatrix();
            CenterBuilding();
        popMatrix();

        pushMatrix();
            Entrance();
        popMatrix();
        
        PillarsAndEntranceRoof();
    }

    function PineTrees() {
        pushMatrix();
            multTranslation([-60,9/2,0]); //valores random, exceto 9/2=halfTrunk height
            pushMatrix();
                pineTrunk();
            popMatrix();
            multTranslation([0,20/2+9/2-0.1,0]);
            //20/2(half leavesHeight) + 9/2(HalfTrunk height) -0.1(para o tronco ficar um pouco dentro das folhas)
            pineLeaves();
        popMatrix();

        pushMatrix();
            multTranslation([50,9/2,-65]); //valores random, exceto 9/2=halfTrunk height
            pushMatrix();
                pineTrunk();
            popMatrix();
            multTranslation([0,20/2+9/2-0.1,0]);
            //20/2(half leavesHeight) + 9/2(HalfTrunk height) -0.1(para o tronco ficar um pouco dentro das folhas)
            pineLeaves();
        popMatrix();

        pushMatrix();
            multTranslation([65,9/2,-20]); //valores random, exceto 9/2=halfTrunk height
            pushMatrix();
                pineTrunk();
            popMatrix();
            multTranslation([0,20/2+9/2-0.1,0]);
            //20/2(half leavesHeight) + 9/2(HalfTrunk height) -0.1(para o tronco ficar um pouco dentro das folhas)
            pineLeaves();
        popMatrix();



        multTranslation([-50,9/2,50]); //valores random, exceto 9/2=halfTrunk height
        pushMatrix();
            pineTrunk();
        popMatrix();
        multTranslation([0,20/2+9/2-0.1,0]);
        //20/2(half leavesHeight) + 9/2(HalfTrunk height) -0.1(para o tronco ficar um pouco dentro das folhas)
        pineLeaves();
    }


    function Trees() {

        pushMatrix();
            PineTrees();
        popMatrix();

        pushMatrix();
            multTranslation([50,5/2,25]); // 5/2=halfTrunk height, outros valores sao random
            pushMatrix();
                treeTrunk1();
            popMatrix();
            multTranslation([0,7/2,0]); // 7/2=halfLeaves height
            treeLeaves1();
        popMatrix();

           //this is the tree that was used in the graph
        pushMatrix();
            multTranslation([-40,5/2,-30]); //5/2=halfTrunk height, outros valores sao random
            pushMatrix();
                treeTrunk2();
            popMatrix();
            multTranslation([0,7/2,0]); //7/2=halfLeaves height
            treeLeaves2();
        popMatrix();

        
        pushMatrix();
            multTranslation([-30,5/2,30]); // 5/2=halfTrunk height, outros valores sao random
            pushMatrix();
                treeTrunk1();
            popMatrix();
            multTranslation([0,7/2,0]); // 7/2=halfLeaves height
            treeLeaves1();
        popMatrix();


        pushMatrix();
            multTranslation([70,5/2,-60]); //5/2=halfTrunk height, outros valores sao random
            pushMatrix();
                treeTrunk2();
            popMatrix();
            multTranslation([0,7/2,0]); //7/2=halfLeaves height
            treeLeaves2();
        popMatrix();


        pushMatrix();
            multTranslation([-70,5/2,-60]); //5/2=halfTrunk height, outros valores sao random
            pushMatrix();
                treeTrunk2();
            popMatrix();
            multTranslation([0,7/2,0]); //7/2=halfLeaves height
            treeLeaves2();
        popMatrix();


        pushMatrix();
            multTranslation([35,11/2,45]);
            pushMatrix();
                treeTrunk3();
            popMatrix();
            multTranslation([0,11/2,0]); //9/2=halfLeaves height
            treeLeaves3();
        popMatrix();


        pushMatrix();
            multTranslation([-50,11/2,-55]);
            pushMatrix();
                treeTrunk3();
            popMatrix();

            multTranslation([0,11/2,0]); //9/2=halfLeaves height
            treeLeaves3();
        popMatrix();

        multTranslation([50,11/2,-30]);
        pushMatrix();
            treeTrunk3();
        popMatrix();

        multTranslation([0,11/2,0]); //9/2=halfLeaves height
        treeLeaves3();

    }

    function World() {
        
        //Surface 
        pushMatrix();
            Plane();    
        popMatrix();

        // Trees
        pushMatrix();
            Trees();
        popMatrix();

        // Pond and Pavement 
        pushMatrix();
            PondAndPavement();
        popMatrix();

        // Benches
        pushMatrix();
            Benches();
        popMatrix();
           
        // Tables
        pushMatrix();
            Tables();
        popMatrix(); 

        // Building
        pushMatrix();
            Building();
        popMatrix();


        //Helicopter
        pushMatrix();         
            multRotationY(rotation); // rotation around the Y axis
            multTranslation([RADIUS,0.0,0.0]); // helicopter translation to rotate Y axis with 30 radius
            //                 Y_SCALEY_BODY*3/4                             0.5                          3                        rotateZ     0.5             
            multTranslation([0,Y_PLANE/2+Y_SCALE*(Y_BODY*3/4+X_LANDING_GEAR/2)+height,0.0]); //4 = ((yPlane/2) + (0.4*y translation in landing gear) + (0.4*xLandingGear/2)) 
            multRotationY(-90);
            multRotationZ(inclination);
            updatePositionsAndVelocity();          // Updates current position
            multScale([X_SCALE,Y_SCALE,Z_SCALE]);
            Helicopter();
            
        popMatrix();

        //Created boxes
        Boxes();
    }


    function render(timeRender) {
        if (typeof lastTime == undefined) 
            lastTime = timeRender/1000;
        
        lastMovement = rotation;
        time = timeRender/1000;
        dt = time - lastTime;

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
                        // The helicopter only takes off if the helices are rotating at maximum speed
                        if (height < MAX_HEIGHT && helixAngularVelocity == MAX_HELIX_ANGULAR_VELOCITY) {
                            height += 0.25;
                        }
                        else if (helixAngularVelocity < MAX_HELIX_ANGULAR_VELOCITY) {
                            helixAngularVelocity = helixAngularVelocity + dt*HELIX_ANGULAR_ACCELERATION > MAX_HELIX_ANGULAR_VELOCITY ? MAX_HELIX_ANGULAR_VELOCITY : helixAngularVelocity + dt*HELIX_ANGULAR_ACCELERATION;
                            helixRotation += helixAngularVelocity*dt;
                        }
                        break;
                    case 'ArrowDown':
                        if (height > 0 ) {                       
                            height = height - 0.25;
                        }
                        break;
                    case 'ArrowLeft':
                        if (height > 0) {
                            rotation += angularVelocity*dt;
                            if (angularVelocity < MAX_ANGULAR_VELOCITY)
                                //If the next value is above the max value set at max value
                                angularVelocity = angularVelocity + dt*ANGULAR_ACCELERATION > MAX_ANGULAR_VELOCITY ? MAX_ANGULAR_VELOCITY: angularVelocity + dt*ANGULAR_ACCELERATION;
                            if (inclination < MAX_INCLINATION)
                                //If the next value is above the max value set at max value
                                inclination = inclination + dt*HELICOPTER_INCLINATION > MAX_INCLINATION ? MAX_INCLINATION : inclination + dt*HELICOPTER_INCLINATION;
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
            else { //Key is not pressed
                /*
                 * If ArrowLeft is being pressed and the helicopter descends to ground level 
                 * the landing will be adjusted as well
                */
                if (k == 'ArrowLeft' || height == 0) {
                    if (angularVelocity > 0) {
                        //If the next value is below the min value set at min value
                        angularVelocity = angularVelocity - dt*ANGULAR_ACCELERATION < 0 ? 0 : angularVelocity-dt*ANGULAR_ACCELERATION;
                        rotation += angularVelocity*dt;
                    }

                    if (inclination > 0)
                        //If the next value is below the min value set at min value
                        inclination = inclination - dt*HELICOPTER_INCLINATION < 0 ? 0 : inclination - dt*HELICOPTER_INCLINATION;
                }
                // When the helicopter is on the ground and ArrowUp is not being pressed the helices will progressively stop rotating
                if (k == 'ArrowUp' && height == 0 && helixAngularVelocity > 0) {
                    //If the next value is below the min value set at min value
                    helixAngularVelocity = helixAngularVelocity - dt*HELIX_ANGULAR_ACCELERATION < 0 ? 0 : helixAngularVelocity - dt*HELIX_ANGULAR_ACCELERATION;
                    helixRotation += dt*helixAngularVelocity;
                }
            }

        }    
        
        
        if (height > 0) {
            //If the next value is above the max value set at max value
            helixAngularVelocity = helixAngularVelocity + dt*HELIX_ANGULAR_ACCELERATION > MAX_HELIX_ANGULAR_VELOCITY ? MAX_HELIX_ANGULAR_VELOCITY : helixAngularVelocity + dt*HELIX_ANGULAR_ACCELERATION;
            helixRotation += dt*helixAngularVelocity;
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

        if (helicopterOnly.mode) {
            multScale([2,2,2]);
            Helicopter();
        }
        
        else
            World();

        lastTime = time;
        let movementAngle = Math.abs(lastMovement-rotation);
        // Angular velocity * RADIUS
        linearVelocity= Math.tan(movementAngle*Math.PI/180)*RADIUS;     

        console.log(helixRotation);
    }
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))