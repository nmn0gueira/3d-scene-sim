import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { ortho, lookAt, flatten, vec4, inverse, mult, rotateX, rotateY } from "../../libs/MV.js";
import { modelView, loadMatrix, multRotationX, multRotationZ, multRotationY, multScale, multTranslation, pushMatrix, popMatrix } from "../../libs/stack.js";

import * as SPHERE from '../../libs/objects/sphere.js';
import * as CUBE from '../../libs/objects/cube.js'
import * as CYLINDER from '../../libs/objects/cylinder.js'
import { GUI } from "../libs/dat.gui.module.js";


/** @type WebGLRenderingContext */
let gl;

let time = 0;           // Global simulation time in seconds
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let animation = true;   // Animation is running
let objectProps = {gamma:0, theta:0};
let axonometricProjection = true; // the program starts with axonometric projection
let arrowLeft = false;
let keys = {};

const WORLD_SCALE = 50; 
const EARTH_GRAVITY = 9.8;
const MAX_HEIGHT = 30;
const MAX_SPEED = 5;
const MAX_INCLINATION = 30;
const HELICOPTER_ACCELERATION = 0.25; // MAX_SPEED/20   antes estava MAX_SPEED/10
const HELICOPTER_INCLINATION = 1.5; // MAX_INCLINATION/20 antes estava MAX_INCLINATION/10

//Helicopter related
let speed = 0;          
let height = 0;
let movement = 0;       // Y axis rotation related to the center of the world
let inclination = 0;    // X axis rotation on the helicopter
let position;           // World coordinates of the helicopter
let boxes = [];         // Boxes the helicopter drops


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
            case 'ArrowUp':
                //fazer com que so levante voo apos rodar as helices com uma certa velocidade
                if (height < MAX_HEIGHT) {
                    height += 0.5;
                }
                break;
            case 'ArrowDown':
                if (height > 0) {
                    height -= 0.5;
                }
                break;
            case 'ArrowLeft':
                arrowLeft = true;
                if (height > 0) {
                    movement += speed;      // move the helicopter with a certain speed
                    if (speed < MAX_SPEED)
                        speed += HELICOPTER_ACCELERATION;
                    if (inclination < MAX_INCLINATION)
                        inclination += HELICOPTER_INCLINATION;
                }
                break;
            case ' ':
                if (height > 0)
                    boxes.push({ time: time, speed: speed, point: position });
                break;
            case '1':
                // Axonometric
                axonometricProjection = true;
                break;
            case '2':
                // Front view
                mView = lookAt([0, 0, 1], [0, 0, 0], [0, 1, 0]);
                axonometricProjection = false;
                break;
            case '3':
                // Top view
                mView = lookAt([0, 1, 0], [0, 0, 0], [0, 0, -1]);
                axonometricProjection = false;
                break;
            case '4':
                // Right view
                mView = lookAt([1, 0, 0], [0, 0, 0], [0, 1, 0]);
                axonometricProjection = false;
                break;
            /*case '5':
                mView = lookAt(helicopterPosition, [0, 0, 0], [0, 1, 0]);
                axonometricProjection = false;
                break;*/
            case 'k':
                //regressa ao normal, nao e para o trabalho, so para ajudar
                mView = lookAt([0, WORLD_SCALE, WORLD_SCALE], [0, 0, 0], [0, 1, 0]);
                break;
        }
    }
    // para a caixa (n sei se se faz onkeyup ou onkeydown)
    document.body.onkeyup = function(event) {
        /*if (event.code == "Space" && airborne) {
            boxes.push({time:time, speed:speed, point: helicopterPosition});
        }*/
        // the helicopter cannot go down before being finishing going down
        /*if (event.code == "ArrowUp" && airborne == false && time - timeLanding > 1) {
            airborne = true;
            timeTakeoff = time;
        }
        // the helicopter cannot go down before being finishing going up
        if (event.code == "ArrowDown" && airborne == true && time - timeTakeoff > 1) {
            airborne = false;
            timeLanding = time;
        }*/
        if (event.code == "ArrowLeft")
            arrowLeft = false;
            // Codigo para abrandar o helicoptero
      }


    gl.clearColor(135/255, 206/255, 235/255, 1.0); // 135, 206, 235 Sky
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
        multRotationY(time * 360 * 2);
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
        multRotationY(time * 360 * 2); // two cycles per second (vezes speed para ir ganhando velocidade)
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

        let color = [42/255,41/255,34/255,1.0]; // Asphalt
        
        setColor(color);

        uploadModelView();

        CUBE.draw(gl, program, mode);
    }

    function box() {
        multScale([4,2,1]); //20/5 10/5 5/5

        let color = [0.0,1.0,0.0,1.0]; // Green
        
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

    function mModelPoint() {
        let mModel = mult(inverse(mView), modelView()); // se n for assim é ao contrario
        let point = mult(mModel, vec4(0.0,0.0,0.0,1.0));
        
        return [point[0],point[1],point[2]];
    }


    function Boxes() {
        for (const b of boxes) {
            if (time - b.time < 5) {
                pushMatrix();
                    multTranslation([b.point[0],b.point[1],b.point[2]]);
                    //b.point[1] is the height at which the box was dropped
                    //1.5 = (yBox/2+yPlane/2)
                    if (b.speed < b.point[1]-1.5) {
                        //var position = 0;
                        multTranslation([0.0,-b.speed,0.0]);
                        //b.point[1] += b.speed; //b.point[1] position Y of the box
                        b.speed+=(time-b.time)/EARTH_GRAVITY; // NAO SEI SE ESTA NECESSARIAMENTE CERTO E NAO TOMA EM CONTA A VELOCIDADE DA ANIMAÇAO AUMENTAR O QUE AINDA NAO SEI SE EXISTE
                    } 
                    else
                        multTranslation([0.0,-(b.point[1]-1.5),0.0]) // puts the box on the floor

                    box();

                popMatrix();
            }
            //If a box has existed for more than 5 seconds it disappears
            else 
                boxes.shift();  // FIFO The box to disappear will always be the earliest dropped
        } 
    }

    function World() {
        //Sun (EXPERIMENTAL)
        pushMatrix();
            multTranslation([50, 30,0]);    // 50 = WORLD_SCALE, 30 = 3WORLD_SCALE/5
            Sun();
        popMatrix();
        //Plane  
        pushMatrix();
            multRotationY(45); //DESNECESSARIO PROVAVELMENTE
            Plane();
        popMatrix();
        //Helicopter
        pushMatrix();         
            multRotationY(movement); // movimento em torno de y do helicoptero
            multTranslation([30,0.0,0.0]); // translaçao do helicoptero (o raio é 30)
            multTranslation([0,2.5+height,0.0]); //2.5 = ((yPlano/2) + (0.2*translaçao em y de landing gear) + (0.2*yLandingGear/2))
            multRotationY(-90);
            multRotationZ(inclination);
            position = mModelPoint();
            multScale([0.2,0.2,0.2]);
            buildHelicopter();
        popMatrix();
        //Created boxes
        Boxes();
    }


    function render() {
        if (animation) time += 1/60;
        window.requestAnimationFrame(render);

        if (!arrowLeft) {
          
            if (speed > 0) {
                speed -= HELICOPTER_ACCELERATION;
                movement += speed;      
            }

                
            if (inclination > 0)
               inclination -= HELICOPTER_INCLINATION;
        }               

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(program);

        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));

        //(a unica coisa que pode tar mal é a ordem das multiplicaçoes, mas acho que ja ta bem)
        if (axonometricProjection)                                                     
            mView = mult(rotateY(objectProps.theta),mult(rotateX(objectProps.gamma), lookAt([0, 0, 1], [0, 0, 0], [0, 1, 0])));

        loadMatrix(mView);
        World();
    }
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))