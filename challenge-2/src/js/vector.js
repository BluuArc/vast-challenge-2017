//source: https://evanw.github.io/lightgl.js/docs/vector.html

function Vector(x, y, z) {
    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
}

Vector.prototype = {
    negative: function () {
        return new Vector(-this.x, -this.y, -this.z);
    },
    add: function (v) {
        if (v instanceof Vector) return new Vector(this.x + v.x, this.y + v.y, this.z + v.z);
        else return new Vector(this.x + v, this.y + v, this.z + v);
    },
    subtract: function (v) {
        if (v instanceof Vector) return new Vector(this.x - v.x, this.y - v.y, this.z - v.z);
        else return new Vector(this.x - v, this.y - v, this.z - v);
    },
    multiply: function (v) {
        if (v instanceof Vector) return new Vector(this.x * v.x, this.y * v.y, this.z * v.z);
        else return new Vector(this.x * v, this.y * v, this.z * v);
    },
    divide: function (v) {
        if (v instanceof Vector) return new Vector(this.x / v.x, this.y / v.y, this.z / v.z);
        else return new Vector(this.x / v, this.y / v, this.z / v);
    },
    equals: function (v) {
        return this.x == v.x && this.y == v.y && this.z == v.z;
    },
    dot: function (v) {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    },
    cross: function (v) {
        return new Vector(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        );
    },
    length: function () {
        return Math.sqrt(this.dot(this));
    },
    unit: function () {
        return this.divide(this.length());
    },
    min: function () {
        return Math.min(Math.min(this.x, this.y), this.z);
    },
    max: function () {
        return Math.max(Math.max(this.x, this.y), this.z);
    },
    toAngles: function () {
        return {
            theta: Math.atan2(this.z, this.x),
            phi: Math.asin(this.y / this.length())
        };
    },
    angleTo: function (a) {
        return Math.acos(this.dot(a) / (this.length() * a.length()));
    },
    toArray: function (n) {
        return [this.x, this.y, this.z].slice(0, n || 3);
    },
    clone: function () {
        return new Vector(this.x, this.y, this.z);
    },
    init: function (x, y, z) {
        this.x = x; this.y = y; this.z = z;
        return this;
    },
    //based on https://stackoverflow.com/questions/28112315/how-do-i-rotate-a-vector
    rotateXY: function (angleDeg) {
        let cos, sin;
        if (angleDeg !== 90) {
            angleDeg = -angleDeg * (Math.PI / 180);
            cos = Math.cos(angleDeg);
            sin = Math.sin(angleDeg);
        } else {
            cos = 0;
            sin = 1;
        }
        return new Vector(Math.round(10000 * (this.x * cos - this.y * sin)) / 10000, Math.round(10000 * (this.x * sin + this.y * cos)) / 10000, this.z);
    }
};