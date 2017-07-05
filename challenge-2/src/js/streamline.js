`use strict`;

var tooltip = tooltip || new Tooltip();

let StreamlineGraph = function (options) {
    console.log("received options:", options);
    options = options || {};
    let self = this;
    let w = 400, h = 400;
    let padding = 25;
    let glyphSize = 45; //size of things on the map
    let svg = d3.select('#streamline-graph').append('svg').classed('svg-content', true)
        .attr('viewBox', `0 0 ${w} ${h}`).attr('preserveAspectRatio', `xMinYMin meet`).attr('style','border:1px red');
    let scales = {};
    let windGlyphs = [];
    let isSimulating = false;
    let windVectors = [], timeStamps = [];
    let diffusion_rate = 1;

    let line = d3.line()
        .x((d) => { return d.x; }).y((d) => {return d.y; })
        .curve(d3.curveCatmullRom);

    let sensors = [
        { name: '1', location: [62, 21] },
        { name: '2', location: [66, 35] },
        { name: '3', location: [76, 41] },
        { name: '4', location: [88, 45] },
        { name: '5', location: [103, 43] },
        { name: '6', location: [102, 22] },
        { name: '7', location: [89, 3] },
        { name: '8', location: [74, 7] },
        { name: '9', location: [119, 42] },
    ];

    let factories = [
        { name: 'Roadrunner Fitness Electronics', id: 'Roadrunner-Fitness-Electronics', location: [89, 27], shape: 'square', },
        { name: 'Kasios Office Furniture', id: 'Kasios-Office-Furniture', location: [90, 21], shape: '+', },
        { name: 'Radiance ColourTek', id: 'Radiance-ColourTek', location: [109, 26], shape: 'circle', },
        { name: 'Indigo Sol Boards', id: 'Indigo-Sol-Boards', location: [120, 22], shape: 'x', },
    ];

    function drawPointAt(x,y){
        if (x instanceof Vector) {
            y = x.y;
            x = x.x;
        }

        return svg.append('circle')
            .attr('r', 5)
            .attr('cx', x)
            .attr('cy', y);
    }

    //empty message removes events
    function setTooltipEvents(target,message){
        if(!message || message.length === 0){
            target.on('mouseenter', undefined)
                .on('mouseleave', undefined);
        }else{
            target.on('mouseenter', function () {
                tooltip.setContent(message);
                tooltip.showAt(d3.event.pageX, d3.event.pageY);
            }).on('mouseleave', function () {
                tooltip.hide();
            });
        }
    }

    //pixel refers to original 200x200 coordinates or zoomed in coordinates while SVG refers to SVG coordinates
    self.init = function(options){
        scales = options.scales || scales;

        let svgRange = {
            x: [padding, w - padding * 2],
            y: [h - padding, padding]
        };
        //relative to bottom left
        let xPixelRange = [50,125];
        let yPixelRange = [0,50];

        scales.PixelToMiles = d3.scaleLinear()
            .domain([0,200]).range([0,12]); //200x200 pixel map -> 12x12 mile map

        scales.xPixelToSVG = d3.scaleLinear().domain(xPixelRange).range(svgRange.x);
        scales.yPixelToSVG = d3.scaleLinear().domain(yPixelRange).range(svgRange.y);

        scales.xMilesToSVG = d3.scaleLinear().domain([scales.PixelToMiles(50),scales.PixelToMiles(125)]).range(svgRange.x);
        scales.yMilesToSVG = d3.scaleLinear().domain([scales.PixelToMiles(0), scales.PixelToMiles(50)]).range(svgRange.y);

        //use miles to SVG scales to get correct tick labels
        let axes = {
            x: d3.axisBottom(scales.xMilesToSVG),
            y: d3.axisLeft(scales.yMilesToSVG).ticks(8)
        };

        //draw axes and glyphs
        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', 'translate(0,' + (h - padding) + ')') //move x-axis to bottom of image
            .call(axes.x);

        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', 'translate(' + padding + ',0)') //move y-axis right to have readable labels
            .call(axes.y);

        drawFactories();
        drawSensors();
        drawWindGlyphs();
    };

    function drawWindGlyphs() {
        //based off of https://codepen.io/zxhfighter/pen/wWKqqX 
        svg.append('defs').append('marker')
            .attr('id', 'arrow')
            .attr('viewBox', '0 0 12 12')
            .attr('refX', '6')
            .attr('refY', '6')
            .attr('markerWidth', '12')
            .attr('markerHeight', '12')
            .attr('orient', 'auto');
        svg.select('#arrow').append('path')
            .attr('d', 'M2,2 L10,6 L2,10 L6,6 L2,2')
            .classed('wind-glyph', true);

        let group = svg.append('g');

        for (let i = 1; i < 4; ++i) {
            for (let j = 1; j < 4; ++j) {
                let defaultTransform = `translate(${w * 0.25 * i},${h * 0.25 * j}) scale(2)`;
                let curGlpyh = group.append("line")
                    .attr("x1", 0)
                    .attr("y1", 1)
                    .attr("x2", 0)
                    .attr("y2", 0)
                    .attr("marker-end", "url(#arrow)")
                    .attr('transform', defaultTransform)
                    .classed('wind-glyph', true).classed('hide',true);
                windGlyphs.push({
                    glyph: curGlpyh,
                    transformation: defaultTransform
                });
            }
        }
    }

    function drawFactories(){
        let factorySVG = svg.selectAll('.factory').data(factories);
        factorySVG.exit().remove();

        let offset = glyphSize * 0.25;
        let newFactories = factorySVG.enter();
        newFactories.each(function (d, i) {
            let curFactory = d3.select(this);
            let location = {
                x: scales.xPixelToSVG(d.location[0]),// - offset / 2,
                y: scales.yPixelToSVG(d.location[1])// - offset / 2
            };
            curFactory = curFactory.append('circle').classed('factory',true)
                .attr('r', offset / 2).classed(`${d.id}`,true)
                .attr('cx', location.x).attr('cy', location.y);
            setTooltipEvents(curFactory, `<b>${d.name}</b>`);
            factories[i].domElement = curFactory;
        });
    }

    function drawSensors(){
        let sensorsSVG = svg.selectAll('.sensor').data(sensors);
        sensorsSVG.exit().remove();

        let offset = glyphSize;
        let newSensors = sensorsSVG.enter();
        newSensors.each(function(d,i){
            let curSensor = d3.select(this);
            let location = {
                x: scales.xPixelToSVG(d.location[0]) - offset / 2,
                y: scales.yPixelToSVG(d.location[1]) - offset / 2
            };
            curSensor = curSensor.append('rect').classed('sensor',true)
                .attr('width',glyphSize).attr('height',glyphSize)
                .attr('x',location.x).attr('y',location.y)
            setTooltipEvents(curSensor, `<b>Sensor ${d.name}</b>`);
            sensors[i].domElement = curSensor;
        });
    }

    self.setSimulationMode = function(bool,data,time_stamp){
        isSimulating = bool;

        windVectors = [];
        timeStamps = [];

        for(let arrow of windGlyphs){
            arrow.glyph.classed('hide',bool !== true);
        }

        if(!bool){
            for(let f of factories){
                drawStreamlinePath(f,[]);
                drawDiffusionPath(f,[]);
            }
        }else{
            self.update(data,1,true,time_stamp);
        }
    };

    //data input is an object with 2 keys: wind and chemical
    //chemical has keys sensor1,sensor2,...,sensor9
    //each sensor object has 4 arrays, each keyed by chemical name
    //wind is an array where each index object has keys direction and speed
    self.update = function(data,difference,render, time_stamp){

        //update wind simulation data
        if(!data.wind || data.wind.length === 0){
            if(isSimulating && render){
                d3.select('#wind-indicator').text("No wind data found for current time stamp");
            }
        }else{
            let windData = data.wind;

            let rotationAngle = windData[0].direction;
            console.log("Updating wind");
            for (let arrow of windGlyphs) {
                arrow.glyph.attr('transform', `${arrow.transformation} rotate(${rotationAngle})`);
            }
            if (windData.length > 1) {
                d3.select('#wind-indicator').text("Multiple wind readings found for current time stamp. Using first reading.");
            }
            if(isSimulating){
                if(difference > 0){
                    let svgVector = new Vector((windData[0].vector.x), (windData[0].vector.y));
                    windVectors.push(svgVector);
                    timeStamps.push(time_stamp);
                }else if (difference < 0){
                    windVectors.pop();
                    timeStamps.pop();
                }
                if(render){
                    console.log("Calculating path for windVectors",windVectors);
                    for(let f of factories){
                        let path = calculateFactoryPath(f,windVectors);
                        console.log("Plotting for",f.name);
                        drawDiffusionPath(f,path.diffusion);
                        drawStreamlinePath(f,path.streamline);
                        drawStreamlinePoints(f,path.streamline,time_stamp);
                    }
                    console.log("Done rendering");
                }
            }
        }
    };

    //calculate the CCW diffusion unit vector from points a, b, and c
    //a is the newest timestamp, and c is the oldest time stamp
    /* Visual representation of points a,b, and c
            c <-- b
                / ^
               /  |
             \/_  |
          bisect  a

    */
    function calculateDiffusionVector(a, b, c) {
        let vectorA, vectorB, unitBisect, doRotate = false;
        console.log("Received", a, b, c);
        if (!b) {
            throw Error("Point B is required");
        } else if (!a && !c) {
            throw Error("Point A or C is required");
        } else {
            if (!a) { //at beginning of path
                console.log("bc");
                vectorB = c.subtract(b); //b -> c
                vectorA = vectorB.multiply(1); //a -> b; extended endpoint
                doRotate = true;
            } else if (!c) { //at end of path
                console.log("ab");
                vectorA = b.subtract(a); //a -> b
                vectorB = vectorA.multiply(1); //b -> c; extended endpoint
                doRotate = true;
            } else { //at middle of path
                console.log("abc");
                vectorA = b.subtract(a); //a -> b
                vectorB = c.subtract(b); //b -> c
            }
        }

        if (doRotate) {
            unitBisect = vectorA.unit().rotateXY(90);
        } else {
            let unitB = vectorB.unit();
            let reverseA = vectorA.multiply(-1);
            let unitReverseA = reverseA.unit();

            // show red reference points
            // let multiplier = 20;
            // plotPointAt(b.add(unitB.multiply(multiplier))).attr('fill','red');
            // plotPointAt(b.add(unitReverseA.multiply(multiplier))).attr('fill','red');

            let fullBisect = unitB.add(unitReverseA);
            unitBisect = fullBisect.unit(); //this is what get's saved
        }

        //keeping one or the other doesn't matter as long as we're consistently picking one side
        let cross = vectorA.cross(unitBisect);
        if (cross.z > 0) {
            return unitBisect;
        } else {
            return unitBisect.multiply(-1);
        }
    }

    //points should be in SVG coordinates already
    function calculateDiffusionPath(points){
        function calculateDiffusionVectors(points) {
            let diffusionVectors = [];
            for (let f = 0; f < points.length; ++f) {
                diffusionVectors.push(calculateDiffusionVector(points[f - 1], points[f], points[f + 1]));
            }
            return diffusionVectors;
        }

        let path_points = [];
        if(points.length < 2){
            return [];
        }
        let diffusionVectors = calculateDiffusionVectors(points);

        let end = diffusionVectors.length - 1;
        let multiplier = diffusion_rate * -2;
        //draw half of the path
        for (let f = 0; f < diffusionVectors.length; ++f) {
            path_points.push(points[f].add(diffusionVectors[f].multiply(-multiplier * f)));
        }

        //add middle point
        let radius = diffusion_rate * end;
        let endPoint = ((a, b, c) => {
            //excerpt from calculateDiffusionVector
            let vectorA = b.subtract(a); //a -> b
            let vectorB = vectorA.multiply(-1);
            return vectorA.unit();
        })(points[end - 1], points[end]);
        endPoint = points[end].add(endPoint.multiply(-multiplier * end));
        path_points.push(endPoint);

        for (let f = end; f >= 0; --f) {
            path_points.push(points[f].add(diffusionVectors[f].multiply(multiplier * f)));
        }

        return path_points;
    }

    function calculateFactoryPath(factory,vectors) {
        let streamline_points = []//, diffusion_points = [];
        let startLocation = new Vector(scales.PixelToMiles(factory.location[0]), scales.PixelToMiles(factory.location[1]));
        let end = vectors.length - 1;
        for (let v = 0; v <= end; ++v) {
            let curPoint = startLocation.multiply(1);
            //add vectors to get correct offset
            for (let p = v; p < end; ++p) {
                curPoint = curPoint.add(vectors[p]);
            }
            streamline_points.push(curPoint);
        }
        streamline_points = streamline_points.map((p) => { return new Vector(scales.xMilesToSVG(p.x), scales.yMilesToSVG(p.y)); });
        diffusion_points = calculateDiffusionPath(streamline_points.reverse());

        return {
            streamline: streamline_points,
            diffusion: diffusion_points
        };
    }

    function drawStreamlinePoints(factory,points,cur_time_stamp){
        for (let p = 0; p < points.length; ++p) {
            // console.log("Drawing point",p);
            let curPoint = drawPointAt(points[p])
                .classed(`${factory.id}`, true)
                .attr('id', `${factory.id}-streamline`)
                .attr('r', 3)
                .attr('style', 'opacity:0.75;')
            setTooltipEvents(curPoint, `<b class=${factory.id}>${factory.name}</b><br>${timeStamps[points.length - p] || cur_time_stamp}`);
        }
    }

    function drawStreamlinePath(factory,points){
        svg.selectAll(`#${factory.id}-streamline`).remove();
        svg.append('path').attr('id',`${factory.id}-streamline`).classed(`${factory.id}`,true)
            .datum(points).attr('d',line).attr('style','fill: none; pointer-events:none;')
    }

    function drawDiffusionPath(factory,points){
        svg.selectAll(`#${factory.id}-diffusion`).remove();
        svg.append('path').attr('id', `${factory.id}-diffusion`).classed(`${factory.id}`, true)
            .datum(points).attr('d', line).attr('style', 'opacity: 0.5; pointer-events:none;')
    }
}

