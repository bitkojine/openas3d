
// Mock THREE.js for Node environment tests

export class Vector3 {
    public x: number;
    public y: number;
    public z: number;

    constructor(x: number = 0, y: number = 0, z: number = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    copy(v: Vector3) {
        this.x = v.x;
        this.y = v.y;
        this.z = v.z;
        return this;
    }

    set(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }

    setY(y: number) {
        this.y = y;
        return this;
    }

    add(v: Vector3) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
    }

    sub(v: Vector3) {
        this.x -= v.x;
        this.y -= v.y;
        this.z -= v.z;
        return this;
    }

    multiplyScalar(s: number) {
        this.x *= s;
        this.y *= s;
        this.z *= s;
        return this;
    }

    clone() {
        return new Vector3(this.x, this.y, this.z);
    }

    normalize() {
        return this;
    }

    subVectors(a: Vector3, b: Vector3) {
        this.x = a.x - b.x;
        this.y = a.y - b.y;
        this.z = a.z - b.z;
        return this;
    }

    addVectors(a: Vector3, b: Vector3) {
        this.x = a.x + b.x;
        this.y = a.y + b.y;
        this.z = a.z + b.z;
        return this;
    }

    length() { return 1; }
}

export class Object3D {
    public position: Vector3 = new Vector3();
    public rotation: any = { x: 0, y: 0, z: 0 };
    public quaternion: any = {
        setFromUnitVectors: () => { },
        copy: () => { },
        set: () => { }
    };
    public scale: Vector3 = new Vector3(1, 1, 1);
    public children: Object3D[] = [];
    public userData: any = {};
    public name: string = '';
    public visible: boolean = true;

    add(obj: Object3D) {
        this.children.push(obj);
    }

    remove(obj: Object3D) {
        const index = this.children.indexOf(obj);
        if (index > -1) {
            this.children.splice(index, 1);
        }
    }

    lookAt(v: Vector3) { }
}

export class Mesh extends Object3D {
    constructor(public geometry?: any, public material?: any) {
        super();
    }
}

export class Group extends Object3D { }

export class Scene extends Object3D { }

export class BufferGeometry {
    public boundingBox: any = { max: { y: 1 }, min: { y: 0 } };
    setFromPoints() { return this; }
    computeBoundingBox() { return this.boundingBox; }
}

export class BoxGeometry extends BufferGeometry { }
export class ConeGeometry extends BufferGeometry { }

export class MeshLambertMaterial { }
export class MeshBasicMaterial { }
export class LineBasicMaterial { }
export class LineDashedMaterial { }
export class SpriteMaterial { }

export class CanvasTexture {
    public needsUpdate = false;
    public minFilter = 0;
    public magFilter = 0;
    public anisotropy = 0;
    constructor(canvas: any) { }
}

export class Sprite extends Object3D {
    constructor(material?: any) {
        super();
    }
}

export class LinearMipmapLinearFilter { }
export class LinearFilter { }
export class QuadraticBezierCurve3 {
    constructor(v0: any, v1: any, v2: any) { }
    getPoints() { return []; }
    getTangent() { return new Vector3(); }
}
export class Line extends Object3D {
    constructor(geo?: any, mat?: any) { super(); }
    computeLineDistances() { }
}

export const DoubleSide = 2;
