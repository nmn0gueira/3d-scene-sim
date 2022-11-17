import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { ortho, lookAt, flatten } from "../../libs/MV.js";
import {modelView, loadMatrix,multRotationX, multRotationZ, multRotationY, multScale, multTranslation, pushMatrix, popMatrix } from "../../libs/stack.js";

import * as SPHERE from '../../libs/objects/sphere.js';
import * as CUBE from '../../libs/objects/cube.js'
import * as CYLINDER from '../../libs/objects/cylinder.js'


/** @type WebGLRenderingContext */
let gl;

let time = 0;           // Global simulation time in days
let speed = 1/60.0;     // Speed (how many days added to time on each render pass
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let animation = true;   // Animation is running

const PLANET_SCALE = 10;    // scale that will apply to each planet and satellite
const ORBIT_SCALE = 1/60;   // scale that will apply to each orbit around the sun

const SUN_DIAMETER = 1391900;
const SUN_DAY = 24.47; // At the equator. The poles are slower as the sun is gaseous

const MERCURY_DIAMETER = 4866*PLANET_SCALE;
const MERCURY_ORBIT = 57950000*ORBIT_SCALE;
const MERCURY_YEAR = 87.97;
const MERCURY_DAY = 58.646;

const VENUS_DIAMETER = 12106*PLANET_SCALE;
const VENUS_ORBIT = 108110000*ORBIT_SCALE;
const VENUS_YEAR = 224.70;
const VENUS_DAY = 243.018;

const EARTH_DIAMETER = 12742*PLANET_SCALE;
const EARTH_ORBIT = 149570000*ORBIT_SCALE;
const EARTH_YEAR = 365.26;
const EARTH_DAY = 0.99726968;

const MOON_DIAMETER = 3474*PLANET_SCALE;
const MOON_ORBIT = 363396*ORBIT_SCALE*60;
const MOON_YEAR = 28;
const MOON_DAY = 0;

const VP_DISTANCE = 50; //antes estava EARTH_ORBIT



function setup(shaders)
{
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    gl = setupWebGL(canvas);

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    let mProjection = ortho(-VP_DISTANCE*aspect,VP_DISTANCE*aspect, -VP_DISTANCE, VP_DISTANCE,-3*VP_DISTANCE,3*VP_DISTANCE);
    let mView= lookAt([0,VP_DISTANCE,VP_DISTANCE], [0,0,0], [0,1,0]);

    mode = gl.LINES; 

    resize_canvas();
    window.addEventListener("resize", resize_canvas);

    document.onkeydown = function(event) {
        switch(event.key) {
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
                if(animation) speed *= 1.1;
                break;
            case '-':
                if(animation) speed /= 1.1;
                break;
            case'2':
            //frente
                mView =   lookAt([-1, -0.6, 0.], [0, -0.6, 0], [0, 1, 0]);
                break;
            case '3':
                //cima
                mView= lookAt([0,1.6,0],  [0,0.6,0], [0,0,-1]);
                break;
            case '4':
                //lado direito , nest momento esta a nostrar a parte de tras
                mView= lookAt([0,0.6,1], [0,0.6,0], [0,1,0]); 
                break;
            case 'k':
                //regressa ao normal, nao e para o trabalho, so para ajudar
                mView= lookAt([0,VP_DISTANCE,VP_DISTANCE], [0,0,0], [0,1,0]);
                break;

        }
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    SPHERE.init(gl);
    CUBE.init(gl);
    CYLINDER.init(gl);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test
    
    window.requestAnimationFrame(render);


    function resize_canvas(event)
    {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;

        gl.viewport(0,0,canvas.width, canvas.height);
        mProjection =ortho(-VP_DISTANCE*aspect,VP_DISTANCE*aspect, -VP_DISTANCE, VP_DISTANCE,-3*VP_DISTANCE,3*VP_DISTANCE);
    }

    function uploadModelView()
    {
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelView()));
    }

    function setColor(color) {
        //getUniformLocation
        //gl.uniform3f ou 3fv
    }

    function helicopterBody()
    {
        // Don't forget to scale the sun, rotate it around the y axis at the correct speed
        
        multScale([25*2, 25, 25]);
        //multRotationY(360*time/SUN_DAY);

        gl.useProgram(program);
        const uColor = gl.getUniformLocation(program, "uColor");

        gl.uniform4f(uColor, 1.0, 0.0, 0.0, 1.0); // Red
       
        
        // Send the current modelview matrix to the vertex shader
        uploadModelView();

        // Draw a sphere representing the sun
        SPHERE.draw(gl, program, mode);
       
    }

    function helicopterTail1() {
        // Don't forget to scale the sun, rotate it around the y axis at the correct speed

        
        
        multScale([50, 25/4, 25/2]);     
        
        gl.useProgram(program);
        const uColor = gl.getUniformLocation(program, "uColor");

        gl.uniform4f(uColor, 0.0, 1.0, 0.0, 1.0); // Red

        // Send the current modelview matrix to the vertex shader
        uploadModelView();

        // Draw a sphere representing the sun
        SPHERE.draw(gl, program, mode);
      
    }

    function helicopterTail2() {

         multScale([25, 25/2, 25/2]);      

         gl.useProgram(program);
         const uColor = gl.getUniformLocation(program, "uColor");
 
         gl.uniform4f(uColor, 0.0, 0.0, 1.0, 1.0); // Red

         // Send the current modelview matrix to the vertex shader
         uploadModelView();
 
         // Draw a sphere representing the sun
         SPHERE.draw(gl, program, mode);
        
    }
    function helixHolder(){
     multScale([2,10,2]);
     gl.useProgram(program);
     const uColor = gl.getUniformLocation(program, "uColor");
 
     gl.uniform4f(uColor, 0.0, 0.0, 1.0, 1.0); // Red


         uploadModelView();

         CYLINDER.draw(gl, program, mode);

    }



    function mainHelix1(){
          // Don't forget to scale the sun, rotate it around the y axis at the correct speed
        
          multScale([50, 5, 7]);
          //multRotationY(360*time/SUN_DAY);
  
          gl.useProgram(program);
          const uColor = gl.getUniformLocation(program, "uColor");
  
          gl.uniform4f(uColor, 1.0, 0.0, 0.0, 1.0); // Red
         
          
          // Send the current modelview matrix to the vertex shader
          uploadModelView();
  
          // Draw a sphere representing the sun
          SPHERE.draw(gl, program, mode);
    }
    function mainHelix2(){
        multScale([50, 5, 7]);
          //multRotationY(360*time/SUN_DAY);
  
          gl.useProgram(program);
          const uColor = gl.getUniformLocation(program, "uColor");
  
          gl.uniform4f(uColor, 1.0, 0.0, 0.0, 1.0); // Red
         
          
          // Send the current modelview matrix to the vertex shader
          uploadModelView();
  
          // Draw a sphere representing the sun
          SPHERE.draw(gl, program, mode);
    }
    function mainHelix3(){
        multScale([50, 5, 7]);
          //multRotationY(360*time/SUN_DAY);
  
          gl.useProgram(program);
          const uColor = gl.getUniformLocation(program, "uColor");
  
          gl.uniform4f(uColor, 1.0, 0.0, 0.0, 1.0); // Red
         
          
          // Send the current modelview matrix to the vertex shader
          uploadModelView();
  
          // Draw a sphere representing the sun
          SPHERE.draw(gl, program, mode);
    }

    function tailHolder(){
         multScale([3,10,5]);
         gl.useProgram(program);
         const uColor = gl.getUniformLocation(program, "uColor");
 
         gl.uniform4f(uColor, 1.0, 0.0, 1.0, 1.0); // Red


         uploadModelView();

         CYLINDER.draw(gl, program, mode);
    }

    function tailHelix1(){}
    function tailhelix2(){}

    function skidLandingHolder1(){
        multScale([2, 25, 2]);
          multRotationY(360*time/SUN_DAY);
  
          gl.useProgram(program);
          const uColor = gl.getUniformLocation(program, "uColor");
  
          gl.uniform4f(uColor, 1.0, 0.0, 1.0, 1.0); // Red
         
          
          // Send the current modelview matrix to the vertex shader
          uploadModelView();
  
          // Draw a sphere representing the sun
          CUBE.draw(gl, program, mode);
    }

    function skidLandingHolder2(){
        multScale([2, 25, 2]);
          //multRotationY(360*time/SUN_DAY);
  
          gl.useProgram(program);
          const uColor = gl.getUniformLocation(program, "uColor");
  
          gl.uniform4f(uColor, 1.0, 0.0, 0.0, 1.0); // Red
         
          
          // Send the current modelview matrix to the vertex shader
          uploadModelView();
  
          // Draw a sphere representing the sun
          CUBE.draw(gl, program, mode);
    }  

    function skidLandingHolder3(){
        multScale([2, 25, 2]);
          //multRotationY(360*time/SUN_DAY);
  
          gl.useProgram(program);
          const uColor = gl.getUniformLocation(program, "uColor");
  
          gl.uniform4f(uColor, 1.0, 0.0, 0.5, 1.0); // Red
         
          
          // Send the current modelview matrix to the vertex shader
          uploadModelView();
  
          // Draw a sphere representing the sun
          CUBE.draw(gl, program, mode);
    }   

    function skidLandingHolder4(){
      multScale([2, 25, 2]);
      //multRotationY(360*time/SUN_DAY);

      gl.useProgram(program);
      const uColor = gl.getUniformLocation(program, "uColor");

      gl.uniform4f(uColor, 1.0, 1.0, 0.5, 1.0); // Red

      // Send the current modelview matrix to the vertex shader
      uploadModelView();

      // Draw a sphere representing the sun
      CUBE.draw(gl, program, mode);
    }
    function skidLanding1(){
        multScale([3,50,3]);
gl.useProgram(program);
         const uColor = gl.getUniformLocation(program, "uColor");
 
         gl.uniform4f(uColor, 0.0, 1.0, 1.0, 1.0); // Red


         uploadModelView();

         CYLINDER.draw(gl, program, mode);

    }
    function skidLanding2(){
        multScale([3,50,3]);
gl.useProgram(program);
         const uColor = gl.getUniformLocation(program, "uColor");
 
         gl.uniform4f(uColor, 0.5, 0.0, 0.5, 1.0); // Red


         uploadModelView();

         CYLINDER.draw(gl, program, mode);

    }
    


    /*function Sun()
    {
        // Don't forget to scale the sun, romctate it around the y axis at the correct speed
        multScale([SUN_DIAMETER, SUN_DIAMETER, SUN_DIAMETER]);
        multRotationY(360*time/SUN_DAY);

        // Send the current modelview matrix to the vertex shader
        uploadModelView();

        // Draw a sphere representing the sun
        SPHERE.draw(gl, program, mode);
    }

    function Mercury()
    {
        multScale([MERCURY_DIAMETER, MERCURY_DIAMETER, MERCURY_DIAMETER]);
        multRotationY(360*time/MERCURY_DAY);

        // Send the current modelview matrix to the vertex shader
        uploadModelView();

        // Draw a sphere 
        SPHERE.draw(gl, program, mode);
    }

    function Venus()
    {
        multScale([VENUS_DIAMETER, VENUS_DIAMETER, VENUS_DIAMETER]);
        multRotationY(360*time/VENUS_DAY);

        // Send the current modelview matrix to the vertex shader
        uploadModelView();

        // Draw a sphere 
        SPHERE.draw(gl, program, mode);
    }

    function Earth()
    {
        multRotationY(360*time/EARTH_DAY);
        multScale([EARTH_DIAMETER, EARTH_DIAMETER, EARTH_DIAMETER]);

        // Send the current modelview matrix to the vertex shader
        uploadModelView();

        // Draw a sphere 
        SPHERE.draw(gl, program, mode);
    }

    function Moon()
    {
        multScale([MOON_DIAMETER, MOON_DIAMETER, MOON_DIAMETER])

        // Send the current modelview matrix to the vertex shader
        uploadModelView();

        // Draw a sphere 
        SPHERE.draw(gl, program, mode);
    }

    function EarthAndMoon() 
    {
        pushMatrix();
        Earth();
        popMatrix();
        pushMatrix();
            multRotationY(360*time/MOON_YEAR);
            multTranslation([MOON_ORBIT, 0, 0]);
            Moon();
        popMatrix();
    }*/


    function render()
    {
        if(animation) time += speed;
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(program);
        
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));
    
        loadMatrix(mView);

        //translaçao e rotaçao do helicoptero para fazer aqui
        pushMatrix();
        helicopterBody();
        popMatrix();

        
        
         pushMatrix();
           multTranslation([-20,-20,-20]);
           skidLandingHolder1();
         popMatrix();

         pushMatrix();
           multTranslation([-20,-20,20]);
           skidLandingHolder2();
         popMatrix();

         pushMatrix();
           multTranslation([20,-20,-20]);
           skidLandingHolder3();
         popMatrix();
           
           
           pushMatrix();
           multTranslation([20,-20,20]);
           skidLandingHolder4();
           popMatrix();
       
        //main helix
           pushMatrix();
              multTranslation([0,25/2,0]);
                pushMatrix();
                helixHolder();
                popMatrix();
                 pushMatrix();
               //falta rotacao e as outras helices
                 multTranslation([-50/3,25/4,0]);
                 mainHelix1();
                 popMatrix();
           popMatrix();

        //skid part verificar se esta certo
        pushMatrix();
        multTranslation([0,-50,-12]);
        multRotationZ(90);
        
         pushMatrix();
         
        skidLanding1();
         popMatrix();
        popMatrix();
        
       pushMatrix();
       multTranslation([0,-50,12]);
        multRotationZ(90);
         pushMatrix();
        skidLanding2();
         popMatrix();
        popMatrix();
        



//tail
        pushMatrix();
            multTranslation([35, 25/2, 25/4]); // 35?
            pushMatrix();
                helicopterTail1();
            popMatrix();
            pushMatrix();
                multTranslation([21, 13, 25/4]);
                multRotationY(70);
                
                pushMatrix();
                    helicopterTail2();
                popMatrix();

                pushMatrix();
                multRotationY(-70);
                
                 tailHolder();
                popMatrix();
            popMatrix();
            
        popMatrix();


      
        /*
        pushMatrix();
            Sun();
        popMatrix();
        pushMatrix();
            multRotationY(360*time/MERCURY_YEAR);
            multTranslation([MERCURY_ORBIT, 0, 0]);
            Mercury();
        popMatrix();
        pushMatrix();
            multRotationY(360*time/VENUS_YEAR);
            multTranslation([VENUS_ORBIT, 0, 0]);
            Venus();
        popMatrix();
        pushMatrix();
            multRotationY(360*time/EARTH_YEAR);
            multTranslation([EARTH_ORBIT, 0, 0]);
            EarthAndMoon();
        popMatrix();
        */
   

    }
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))