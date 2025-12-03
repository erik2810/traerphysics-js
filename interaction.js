export function makeInteraction(p, particles) {
    let grabbed = null;

    p.mousePressed = () => {
        let closest = null, minDist = 9999;
        for (let pt of particles) {
            const distance = p.dist(p.mouseX, p.mouseY, pt.position.x, pt.position.y);
            if (distance < minDist && distance < 20) {
                minDist = distance;
                closest = pt;
            }
        }
        grabbed = closest;
        if (grabbed) grabbed.pinned = true;
    };

    p.mouseDragged = () => {
        if (grabbed) {
            grabbed.position.x = p.mouseX;
            grabbed.position.y = p.mouseY;
        }
    };

    p.mouseReleased = () => {
        if (grabbed) {
            grabbed.pinned = false;
            grabbed = null;
        }
    };
}