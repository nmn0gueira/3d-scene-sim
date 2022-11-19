import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { ortho, lookAt, flatten, vec4, inverse, mult, rotateX, rotateY } from "../../libs/MV.js";
import { modelView, loadMatrix, multRotationX, multRotationZ, multRotationY, multScale, multTranslation, pushMatrix, popMatrix } from "../../libs/stack.js";

import * as SPHERE from '../../libs/objects/sphere.js';
import * as CUBE from '../../libs/objects/cube.js'
import * as CYLINDER from '../../libs/objects/cylinder.js'


/** @type WebGLRenderingContext */
let gl;

let time = 0;           // Global simulation time in days
let speed = 1 / 60.0;   // Speed (how many days added to time on each render pass)
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let animation = true;   // Animation is running
let gamma = 0;
let theta = 0;
let boxes = [];
let helicopterPosition;

const WORLD_SCALE = 50; 
const EARTH_GRAVITY = 9.8;



function setup(shaders) {
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    gl = setupWebGL(canvas);

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    let mProjection = ortho(-WORLD_SCALE * aspect, WORLD_SCALE * aspect, -WORLD_SCALE, WORLD_SCALE, -3 * WORLD_SCALE, 3 * WORLD_SCALE);
    let mView = lookAt([0, WORLD_SCALE, WORLD_SCALE], [0, 0, 0], [0, 1, 0]);

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
            case '1':
                //axonometrica (a unica coisa que pode tar mal é a ordem das multiplicaçoes)
                mView = mult(lookAt([-1, 0, 0], [0, 0, 0], [0, 1, 0]), mult(rotateX(gamma),rotateY(theta)));
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
                mView = lookAt([0, WORLD_SCALE, WORLD_SCALE], [0, 0, 0], [0, 1, 0]);
                break;

        }
    }
    // para a caixa (n sei se se faz onkeyup ou onkeydown)
    document.body.onkeyup = function(event) {
        if (event.code == "Space") {
            boxes.push({time:time, speed:speed, point: helicopterPosition});
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
        multRotationY(time * 360 * 2); // two cycles per second
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
        multRotationY(time*360/4); // rotaçao do helicoptero
        multTranslation([50,0,0]); // translaçao do helicoptero
        helicopterPosition = mModelPoint();
        multScale([0.2,0.2,0.2]); // scale para por o helicoptero a ser 10m (ISTO NAO SAO 10 METROS)
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

    function buildSurface() {
        multScale([100,1,100]); //11  helicopteros em largura talvez(testar mais tarde?)

        let color = [1.0,1.0,1.0,1.0]; // White
        
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

    function mModelPoint() {
        let mModel = mult(inverse(mView), modelView()); // se n for assim é ao contrario
        let point = mult(mModel, vec4(0.0,0.0,0.0,1.0));
        
        return [point[0],point[1],point[2]];
    }

    function Plane() {
        multTranslation([0.0,-15.0,0.0]); 
        multRotationY(45);
        buildSurface();
    }

    function Boxes() {
        for (const b of boxes) {
            if (time - b.time < 5) { // como fazer para caso de aumentar a velocidade? a caixa desaparece mais rapido?
                pushMatrix();
                    multTranslation(b.point);
                    //fazer uma verificaçao para saber se a caixa ja atingiu o chao
                    if (b.speed < 14) { // the surface is 14 units below the helicopter(MIGHT NEED CHANGING)
                        multTranslation([0.0,-b.speed,0.0]);
                        b.speed+=(time-b.time)/EARTH_GRAVITY;     // NAO SEI SE ESTA NECESSARIAMENTE CERTO
                    } 
                    else
                        multTranslation([0.0,-14,0.0]) // puts the box on the floor

                    box();

                popMatrix();
            }

        } 
    }

    function World() {
        //translaçao e rotaçao do helicoptero para fazer aqui (valores a toa para ver o helicoptero a mexer)
        //Plane  
        pushMatrix();
            Plane();
        popMatrix();
        //Helicopter
        pushMatrix();
            buildHelicopter();
        popMatrix();
        //Created boxes
        Boxes();
    }


    function render() {
        if (animation) time += speed;
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(program);

        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));

        loadMatrix(mView);

        World();
    }
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))