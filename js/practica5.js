// Variables globales
var renderer, scene, camera;
var cameraControls;
var cameraTop;

// Partes móviles del robot
var robot;
var brazo;
var antebrazo;
var pinzas;
var pinzaIzquierda;
var pinzaDerecha;

// Material del robot
var materialRobot;

var controls = {
    giroBase: 0,
    giroBrazo: 0,
    giroAntebrazoY: 0,
    giroAntebrazoZ: 0,
    giroPinza: 0,
    separacionPinza: 10,
    alambres: false,
    animar: function()
    {animacionRobot();}}

// 1. Inicializar
init();
// 2. Crear la escena
loadScene();
// 3. Renderizar
render();

function init()
{
    // Configuración inicial
    renderer = new THREE.WebGLRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setClearColor( new THREE.Color(0xFFFFFF) ); // Color de fondo blanco
    document.getElementById('container').appendChild( renderer.domElement );

    // sombras
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();

    var aspectRatio = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera( 50, aspectRatio , 0.1, 2000 );
    camera.position.set( 300, 300, 300 );

    // vista de planta
    cameraTop = new THREE.OrthographicCamera( -80, 80, 80, -80, 0.1, 1000 );
    cameraTop.position.set(0, 500 ,0);
    cameraTop.up.set(0, 0, 1);
    cameraTop.lookAt(0, 0, 0);
    cameraTop.updateProjectionMatrix();

    cameraControls = new THREE.OrbitControls( camera, renderer.domElement ); // conecta el ratón con la cámara
    cameraControls.target.set(0, 120, 0);

    window.addEventListener('resize', updateAspectRatio );

    window.addEventListener('keydown', movimientoRobot);

    // INTERFAZ
    var gui = new dat.GUI();
    var guiRobot = gui.addFolder("Control Robot");

    guiRobot.add(controls, "giroBase", -180, 180).name("Giro Base").listen();
    guiRobot.add(controls, "giroBrazo", -45, 45).name("Giro Brazo").listen();
    guiRobot.add(controls, "giroAntebrazoY", -180, 180).name("Giro Antebrazo Y").listen();
    guiRobot.add(controls, "giroAntebrazoZ", -90, 90).name("Giro Antebrazo Z").listen();
    guiRobot.add(controls, "giroPinza", -40, 220).name("Giro Pinza").listen();
    guiRobot.add(controls, "separacionPinza", 0, 15).name("Separación Pinza").listen();
    guiRobot.add(controls, "alambres").name("Alámbrico vs Sólido");
    guiRobot.add(controls, "animar").name("Anima");
    guiRobot.open();
}

function loadScene()
{
    // CARGA DE TEXTURAS
    let textureLoader = new THREE.TextureLoader();

    let texturaSuelo = textureLoader.load("images/suelo_metal_fabrica.png"); // La textura define el dibujo/color superficial, pero no cómo refleja la luz.
    texturaSuelo.wrapS = THREE.RepeatWrapping;
    texturaSuelo.wrapT = THREE.RepeatWrapping;
    texturaSuelo.repeat.set(10, 10);

    let texturaAcero = textureLoader.load("images/robot_acero_cepillado.png");
    let texturaMate = textureLoader.load("images/robot_metal_pintado_mate.png");
    let texturaPinza = textureLoader.load("images/pinza_industrial_rayada.png");

    let texPX = textureLoader.load("images/env_px.png");
    let texNX = textureLoader.load("images/env_nx.png");
    let texPY = textureLoader.load("images/env_py.png");
    let texNY = textureLoader.load("images/env_ny.png");
    let texPZ = textureLoader.load("images/env_pz.png");
    let texNZ = textureLoader.load("images/env_nz.png");

    let materialMate = new THREE.MeshLambertMaterial({map: texturaMate});
    let materialBrillante = new THREE.MeshPhongMaterial({map: texturaAcero, shininess: 100});
    let materialPinzaMate = new THREE.MeshLambertMaterial({map: texturaPinza, side: THREE.DoubleSide});

    let cubeLoader = new THREE.CubeTextureLoader();
    let entorno = cubeLoader.load([
            "images/env_px.png",
            "images/env_nx.png",
            "images/env_py.png",
            "images/env_ny.png",
            "images/env_pz.png",
            "images/env_nz.png"]);

    let materialesHabitacion = [new THREE.MeshBasicMaterial({map: texPX,side: THREE.BackSide}), // BackSide para ver las texturas desde el interior del cubo pq la cámara y el robot están dentro de la habitación
        new THREE.MeshBasicMaterial({map: texNX,side: THREE.BackSide}), 
        new THREE.MeshBasicMaterial({map: texPY,side: THREE.BackSide}),
        new THREE.MeshBasicMaterial({visible:false}),
        new THREE.MeshBasicMaterial({map: texPZ,side: THREE.BackSide}),
        new THREE.MeshBasicMaterial({map: texNZ,side: THREE.BackSide})];
    let materialRotula = new THREE.MeshPhongMaterial({envMap: entorno,reflectivity: 1,shininess: 150});

    // habitación
    let geometriaHabitacion = new THREE.BoxGeometry(1000,600,1000);
    let habitacion = new THREE.Mesh(geometriaHabitacion,materialesHabitacion);
    habitacion.position.y = 300;
    scene.add(habitacion);
        
    // suelo
    let geometriaSuelo = new THREE.PlaneGeometry(1000, 1000, 10, 10);
    let materialSuelo = new THREE.MeshLambertMaterial({map: texturaSuelo});
    let suelo = new THREE.Mesh(geometriaSuelo,materialSuelo);
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    suelo.castShadow = false;
    scene.add(suelo); // suelo 1000x1000 en el plano XZ

    // robot
    robot = new THREE.Object3D();
    scene.add(robot);

    // base
    let geometriaBase = new THREE.CylinderGeometry(50, 50, 15, 32); // (50, 50) es el (radio de la base, radio de la parte superior)
    let base = new THREE.Mesh(geometriaBase, materialBrillante);
    base.position.y = 15/2; // poner la base sobre el suelo
    robot.add(base);

    // brazo
    brazo = new THREE.Object3D();
    brazo.position.y = 15;
    robot.add(brazo);

    let geometriaEje = new THREE.CylinderGeometry(20, 20, 18, 32);
    let eje = new THREE.Mesh(geometriaEje, materialMate);
    eje.rotation.z = Math.PI / 2;
    eje.position.y = 0;
    brazo.add(eje);

    let geometriaEsparrago = new THREE.BoxGeometry(18, 120, 12);
    let esparrago = new THREE.Mesh(geometriaEsparrago, materialMate);
    esparrago.position.y = 120 / 2;
    brazo.add(esparrago);

    let geometriaRotula = new THREE.SphereGeometry(20, 32, 16);
    let rotula = new THREE.Mesh(geometriaRotula, materialRotula);
    rotula.position.y = 120;
    brazo.add(rotula);

    // antebrazo
    antebrazo = new THREE.Object3D();
    antebrazo.position.y = 120;
    brazo.add(antebrazo);


    let geometriaDisco = new THREE.CylinderGeometry(22, 22, 6, 32);
    let disco = new THREE.Mesh(geometriaDisco, materialBrillante);
    antebrazo.add(disco);

    let geometriaNervio = new THREE.BoxGeometry(4, 80, 4);
    // Nervio 1
    let nervio1 = new THREE.Mesh(geometriaNervio, materialMate);
    nervio1.position.set(10, 80 / 2, 10);
    antebrazo.add(nervio1);
    // Nervio 2
    let nervio2 = new THREE.Mesh(geometriaNervio, materialMate);
    nervio2.position.set(-10, 80 / 2, 10);
    antebrazo.add(nervio2);
    // Nervio 3
    let nervio3 = new THREE.Mesh(geometriaNervio, materialMate);
    nervio3.position.set(10, 80 / 2, -10);
    antebrazo.add(nervio3);
    // Nervio 4
    let nervio4 = new THREE.Mesh(geometriaNervio, materialMate);
    nervio4.position.set(-10, 80 / 2, -10);
    antebrazo.add(nervio4);

    // mano
    let geometriaMano = new THREE.CylinderGeometry(15, 15, 40, 32);
    let mano = new THREE.Mesh(geometriaMano, materialBrillante);
    mano.rotation.z = Math.PI / 2;
    mano.position.y = 80;
    antebrazo.add(mano);

    // pinzas
    pinzas = new THREE.Object3D();
    pinzas.position.y = 80;
    pinzas.rotation.x = Math.PI / 2;
    antebrazo.add(pinzas);

    pinzaIzquierda = crearPinza(materialPinzaMate);
    pinzaIzquierda.position.set(-12, 0, 0);
    pinzas.add(pinzaIzquierda);

    pinzaDerecha = crearPinza(materialPinzaMate);
    pinzaDerecha.position.set(12, 0, 0);
    pinzas.add(pinzaDerecha);


    let luzAmbiental = new THREE.AmbientLight(0xffffff,0.5);
    scene.add(luzAmbiental);

    let luzDireccional = new THREE.DirectionalLight(0xffffff,0.8);
    luzDireccional.position.set(250,400,250);
    luzDireccional.castShadow = true;
    luzDireccional.shadow.mapSize.width = 2048;
    luzDireccional.shadow.mapSize.height = 2048;
    luzDireccional.shadow.camera.left = -300;
    luzDireccional.shadow.camera.right = 300;
    luzDireccional.shadow.camera.top = 300;
    luzDireccional.shadow.camera.bottom = -300;

    luzDireccional.shadow.camera.near = 0.5;
    luzDireccional.shadow.camera.far = 1000;
    scene.add(luzDireccional);

    let luzFocal = new THREE.SpotLight(0xffffff,1.2);
    luzFocal.position.set(-200,400,150);
    luzFocal.target.position.set(0,100,0);
    luzFocal.angle = Math.PI / 5;
    luzFocal.penumbra = 0.3;
    luzFocal.distance = 1000;
    luzFocal.decay = 1;
    luzFocal.castShadow = true;
    luzFocal.shadow.mapSize.width = 2048;
    luzFocal.shadow.mapSize.height = 2048;
    luzFocal.shadow.camera.near = 10;
    luzFocal.shadow.camera.far = 1000;
    scene.add(luzFocal);
    scene.add(luzFocal.target);

    robot.traverse(function(objeto)
{
    if (objeto.isMesh)
    {objeto.castShadow = true;
    objeto.receiveShadow = true;}
});

}


function crearPinza(materialRobot)
{
    let pinza = new THREE.Object3D();

    let geometriaCaja = new THREE.BoxGeometry(4, 20, 19);
    let caja = new THREE.Mesh(geometriaCaja, materialRobot);
    caja.position.y = -10;
    pinza.add(caja);


    let geometriaDedo = new THREE.BufferGeometry();
    
    // prisma cuya parte inferior es más estrecha que la superior.
    let vertices = new Float32Array([
        // CARA DELANTERA
        -2,   0,   9.5,
         2,   0,   9.5,
         1, -19,   2,
        
        -2,   0,   9.5,
         1, -19,   2,
        -1, -19,   2,
        // CARA TRASERA
         2,   0,  -9.5,
        -2,   0,  -9.5,
        -1, -19,  -2,

         2,   0,  -9.5,
        -1, -19,  -2,
         1, -19,  -2,
        // CARA IZQUIERDA
        -2,   0,  -9.5,
        -2,   0,   9.5,
        -1, -19,   2,

        -2,   0,  -9.5,
        -1, -19,   2,
        -1, -19,  -2,
        // CARA DERECHA
         2,   0,   9.5,
         2,   0,  -9.5,
         1, -19,  -2,

         2,   0,   9.5,
         1, -19,  -2,
         1, -19,   2,
        // CARA SUPERIOR
        -2, 0, -9.5,
         2, 0, -9.5,
         2, 0,  9.5,

        -2, 0, -9.5,
         2, 0,  9.5,
        -2, 0,  9.5,
        // CARA INFERIOR
        -1, -19,  2,
         1, -19,  2,
         1, -19, -2,

        -1, -19,  2,
         1, -19, -2,
        -1, -19, -2
    ]);


    geometriaDedo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

    geometriaDedo.computeVertexNormals(); // las normales

    let dedo = new THREE.Mesh(geometriaDedo, materialRobot);
    dedo.position.y = -20;

    pinza.add(dedo);
    return pinza;
}


function movimientoRobot(event)
{
    var velocidad = 5;
    switch(event.key)
    {
        case "ArrowUp":
            robot.position.z -= velocidad;
            break;
        case "ArrowDown":
            robot.position.z += velocidad;
            break;
        case "ArrowLeft":
            robot.position.x -= velocidad;
            break;
        case "ArrowRight":
            robot.position.x += velocidad;
            break;
    }
}

function animacionRobot()
{// Primer movimiento
    let movimiento1 = new TWEEN.Tween(controls)
        .to({giroBase: -90,giroBrazo: -30,giroAntebrazoY: -90,giroAntebrazoZ: -45,giroPinza: 30,
            separacionPinza: 15}, 2000).easing(TWEEN.Easing.Quadratic.InOut);
    // Segundo movimiento
    let movimiento2 = new TWEEN.Tween(controls)
        .to({giroBase: 90,giroBrazo: 30,giroAntebrazoY: 90,giroAntebrazoZ: 45,giroPinza: 150,
            separacionPinza: 5}, 2500).easing(TWEEN.Easing.Quadratic.InOut);
    // Volver a la posición inicial
    let movimiento3 = new TWEEN.Tween(controls)
        .to({giroBase: 0,giroBrazo: 0,giroAntebrazoY: 0,giroAntebrazoZ: 0,giroPinza: 0,
            separacionPinza: 10}, 2000).easing(TWEEN.Easing.Quadratic.InOut);

    movimiento1.chain(movimiento2);
    movimiento2.chain(movimiento3);
    movimiento1.start();
}


function updateAspectRatio()
{
    // Ajustar cámara si cambia el tamaño de la ventana
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}

function update()
{
    // Actualizaciones por frame
    cameraControls.update();
    TWEEN.update();

    robot.rotation.y = controls.giroBase * Math.PI / 180;

    brazo.rotation.x = controls.giroBrazo * Math.PI / 180;

    antebrazo.rotation.y = controls.giroAntebrazoY * Math.PI / 180;
    antebrazo.rotation.x = controls.giroAntebrazoZ * Math.PI / 180;

    pinzas.rotation.x = Math.PI / 2 + controls.giroPinza * Math.PI / 180;

    pinzaIzquierda.position.x = -2 - controls.separacionPinza;
    pinzaDerecha.position.x = 2 + controls.separacionPinza;

    robot.traverse(function(objeto)
{
    if (objeto.isMesh)
    {
        objeto.material.wireframe = controls.alambres;
    }
});
}

function render()
{
    requestAnimationFrame(render);
    update();

    // vista 3d perspectiva
    renderer.autoClear = false;
    renderer.setViewport(0,0,window.innerWidth,window.innerHeight); // dibuja la cámara en una zona
	renderer.setClearColor( new THREE.Color(0xa2a2f2) );
	renderer.clear();
	renderer.render( scene, camera );

    // vista de arriba
    var ds = Math.min(window.innerHeight , window.innerWidth)/4;
    
    renderer.setViewport(0, window.innerHeight - ds, ds, ds);
	renderer.setScissor(0, window.innerHeight - ds, ds, ds); // no permite que las operaciones de dibujo/borrado afecten fuera de este rectángulo.
	renderer.setScissorTest (true);
	renderer.setClearColor( new THREE.Color(0xaffff) );
	renderer.clear();	
	renderer.setScissorTest (false);
    renderer.render(scene, cameraTop);
}
