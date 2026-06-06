import { Physics } from './traerphysics.js';
import { makeInteraction } from './interaction.js';

const s = (p) => {
    let physics, particles = [], springs = [];
    let mode = 'triangle';
    let dragSlider, attractSlider;

    const sliders = ['drag', 'attract'];


    sliders.forEach(id => {
        const slider = document.getElementById(id);
        const display = document.getElementById(id + '-value');

        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            let displayValue;

            if (id === 'drag' || id === 'attract') {
                displayValue = value.toFixed(2);
            } else if (id === 'repulsion') {
                displayValue = value.toFixed(4);
            } else {
                displayValue = value.toString();
            }

            display.textContent = displayValue;
        });
    });

    p.setup = () => {
        p.createCanvas(800, 600);
        physics = new Physics();
        physics.setDrag(0.02);

        // UI
        const modeSelect = p.createSelect();
        modeSelect.position(10, 10);
        modeSelect.option('triangle');
        modeSelect.option('attraction');
        modeSelect.option('rope');
        modeSelect.option('cloth');
        modeSelect.changed(() => setupMode(modeSelect.value()));

        dragSlider = p.createSlider(0, 0.1, 0.02, 0.001);
        dragSlider.position(10, 40);
        attractSlider = p.createSlider(0, 5000, 2000, 100);
        attractSlider.position(10, 70);

        setupMode(mode);
    };

    function setupMode(newMode) {
        mode = newMode;
        physics = new Physics();
        physics.setDrag(dragSlider.value());
        particles = [];
        springs = [];

        if (mode === 'triangle') {
            let p1 = physics.makeParticle(300, 200);
            let p2 = physics.makeParticle(340, 300);
            let p3 = physics.makeParticle(260, 300);
            particles.push(p1, p2, p3);
            springs.push(physics.makeSpring(p1, p2, 0.05));
            springs.push(physics.makeSpring(p1, p3, 0.05));
            springs.push(physics.makeSpring(p2, p3, 0.05));
            physics.makeAngleConstraint(p2, p1, p3, Math.PI/3, 0.2);
        }

        if (mode === 'attraction') {
            let center = physics.makeParticle(p.width/2, p.height/2, 10);
            center.pinned = true;
            particles.push(center);
            for (let i=0; i<20; i++) {
                let pt = physics.makeParticle(p.random(p.width), p.random(p.height));
                particles.push(pt);
                physics.makeAttraction(center, pt, attractSlider.value(), 20, 500);
            }
        }

        if (mode === 'rope') {
            let prev = physics.makeParticle(400, 50);
            prev.pinned = true;
            particles.push(prev);
            for (let i=1; i<15; i++) {
                let curr = physics.makeParticle(400, 50 + i*20);
                particles.push(curr);
                springs.push(physics.makeDistanceConstraint(prev, curr, 20));
                prev = curr;
            }
        }

        if (mode === 'cloth') {
            const cols = 12, rows = 12, spacing = 25;
            for (let y=0; y<rows; y++) {
                for (let x=0; x<cols; x++) {
                    let pt = physics.makeParticle(200 + x*spacing, 50 + y*spacing);
                    if (y === 0) pt.pinned = true;
                    particles.push(pt);
                    if (x > 0) springs.push(physics.makeSpring(pt, particles[particles.length-2], 0.1, spacing));
                    if (y > 0) springs.push(physics.makeSpring(pt, particles[(y-1)*cols+x], 0.1, spacing));
                }
            }
        }

        makeInteraction(p, particles);
    }

    p.draw = () => {
        physics.setDrag(dragSlider.value());
        if (mode === 'attraction') {
            for (let a of physics.attractions) a.strength = attractSlider.value();
        }

        physics.step(0.016);
        p.background(240);

        // springs
        p.stroke(0);
        for (let s of springs) {
            p.line(s.a.position.x, s.a.position.y, s.b.position.x, s.b.position.y);
        }

        // particles
        p.fill(0);
        for (let pt of particles) {
            p.ellipse(pt.position.x, pt.position.y, 8);
        }

        // HUD
        p.noStroke();
        p.fill(50);
        p.text(`Particles: ${particles.length}`, 10, 100);
        p.text(`Springs/Constraints: ${springs.length}`, 10, 120);
    };

    p.keyPressed = () => {
        if (p.key === 'c') {
            particles = [];
            springs = [];
            physics = new Physics();
        }
        if (p.key === 'r') {
            setupMode(mode);
        }
    };
};

new p5(s);