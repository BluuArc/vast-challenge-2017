`use strict`;

var tooltip = tooltip || new Tooltip();

let Graph = function(size){
    let self = this;
    let min = d3.min([d3.select('#graph').node().offsetWidth, d3.select('#graph').node().offsetHeight]);
    size = size || min;
    let w = size || min, h = size || min;
    let kiviatSize = 50;
    let kiviatScale = 1;
    let padding = 50;
    let svg = d3.select('#graph').append('svg')//.attr('width',w).attr('height',h)
        .attr('viewBox',`0 0 ${size} ${size}`)//.attr('preserveAspectRatio', `xMinYMin meet`);
        .attr('style', `max-height:100%`);
    let scales = {}, axes = {};
    let sensorGraphs  = [];
    let sensorLocations = [
        {name: '1', location: [62, 21]},
        {name: '2', location: [66, 35]},
        {name: '3', location: [76, 41]},
        {name: '4', location: [88, 45]},
        {name: '5', location: [103, 43]},
        {name: '6', location: [102, 22]},
        {name: '7', location: [89, 3]},
        {name: '8', location: [74, 7]},
        {name: '9', location: [119, 42]},
    ];
    self.svg = svg;
    let factoryLocations = [
        { name:'Roadrunner Fitness Electronics', location: [89,27]},
        { name:'Kasios Office Furniture', location: [90,21]},
        { name:'Radiance ColourTek', location: [109,26]},
        { name:'Indigo Sol Boards', location: [120,22]}
    ];
    self.init = function(){
        scales.miles = d3.scaleLinear()
            .domain([0, 200])
            .range([0, 12]);

        let xScale = d3.scaleLinear().domain([scales.miles(50), scales.miles(125)])
            .range([padding, w - padding * 2]);//add padding to not go outside bounds
        scales.x = (function(value){ //auto convert original pixel to scaled pixel
            return xScale(scales.miles(value));
        }); 

        let yScale = d3.scaleLinear().domain([scales.miles(0), scales.miles(50)])
            .range([h - padding, padding]); //[h,0] makes it so that smaller numbers are lower; add padding to not go outside bounds
        scales.y = (function (value) { //auto convert original pixel to scaled pixel
            return yScale(scales.miles(value));
        });

        // scales.kiviatSize = {}
        kiviatSize = d3.min([scales.x(50+20), scales.y(20)])/2;
        console.log(kiviatSize);
        axes.x = d3.axisBottom(xScale);
        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', 'translate(0,' + (h - padding) + ')') //move x-axis to bottom of image
            .call(axes.x);

        axes.y = d3.axisLeft(yScale);
        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', 'translate(' + padding + ',0)') //move y-axis right to have readable labels
            .call(axes.y);
    };

    //should only be called once
    self.drawFactories = function(){
        let factories = svg.selectAll('.factory').data(factoryLocations);
        let offset = kiviatSize * 0.25 * kiviatScale;
        factories.exit().remove(); //remove excess

        //update current
        // factories.attr('x', function (d) { return scales.x(d.location[0]) - offset/2; })
        //     .attr('y', function (d) { return scales.y(d.location[1]) - offset/2; });

        //create new as necessary
        let newFactories = factories.enter();
        newFactories.append('rect').classed('factory', true)
            .attr('width', offset).attr('height', offset)
            .attr('x', function (d) { return scales.x(d.location[0]) - offset/2; })
            .attr('y', function (d) { return scales.y(d.location[1]) - offset/2; })
        newFactories.append('text').classed('factory-label',true)
            .attr('x', function (d) { return scales.x(d.location[0]) - offset/2; })
            .attr('y', function (d) { return scales.y(d.location[1]) - offset/2; })
            .text(function(d) { return d.name.split(" ").map(function(n) { return n[0]}).join('');})
    };

    self.drawSensors = function(){
        let sensors = svg.selectAll('.sensor').data(sensorLocations);
        sensors.exit().remove(); //remove excess

        //update current
        // sensors.attr('cx', function (d) { return scales.x(d.location[0]); })
        //     .attr('cy', function (d) { return scales.y(d.location[1]); });
        
        //create new as necessary
        
        sensors.enter().each(function(d,i){
            let curGraph = new Kiviat(svg,{
                x: scales.x(d.location[0]) - (kiviatSize/2) * kiviatScale,
                y: scales.y(d.location[1]) - (kiviatSize/2) * kiviatScale
            },d.name, scales,{
                scale: kiviatScale,
                w: kiviatSize,
                h: kiviatSize
            });
            curGraph.init();
            curGraph.update();
            sensorGraphs.push(curGraph);
        });
    };

    self.update = function(){
        for(let k of sensorGraphs){
            let data = [
                { Chemical: 'Appluimonia', Reading: Math.random() * 2 },
                { Chemical: 'Chlorodinine', Reading: Math.random() * 2 },
                { Chemical: 'Methylosmolene', Reading: Math.random() * 2 },
                { Chemical: 'AGOC-3A', Reading: Math.random() * 2 },
            ];
            k.update(data);
        }
    }

    self.draw = function(dataset, colorScale, dataScales){
        self.scales = dataScales;
        console.log("Received",dataset.length,"data points");
        return new Promise(function(fulfill,reject){
            let xScale = dataScales.xScale.range([padding, w - padding * 2]).nice(); //add padding to not go outside bounds
            let yScale = dataScales.yScale.range([h - padding, padding]).nice(); //[h,0] makes it so that smaller numbers are lower; add padding to not go outside bounds

            //create and remove circles as necessary
            let circles = svg.selectAll('circle')
                .data(dataset);
            circles.exit().remove(); //remove excess as necessary

            //update current selection
            circles.attr('cx', function (d) { return xScale(d.X); })
                    .attr('cy', function (d) { return yScale(d.Y); })
                    // .attr('r', 1)
                    .style('fill', function (d) { return colorScale(d.concentration); });

            //create new as necessary
            circles.enter() 
                .append('circle')
                .attr('cx', function(d){return xScale(d.X);})
                .attr('cy', function(d){return yScale(d.Y);})
                .attr('r', 1)
                .style('fill', function(d){return colorScale(d.concentration);});
            
            //create axes
            if(d3.selectAll('.axis').empty()){//prevent redraw
                let xAxis = d3.axisBottom(xScale);
                svg.append('g')
                    .attr('class', 'axis')
                    .attr('transform', 'translate(0,' + (h - padding) + ')') //move x-axis to bottom of image
                    .call(xAxis);

                let yAxis = d3.axisLeft(yScale);
                svg.append('g')
                    .attr('class', 'axis')
                    .attr('transform', 'translate(' + padding + ',0)') //move y-axis right to have readable labels
                    .call(yAxis);
            }

            //label axes
            //based off of http://bl.ocks.org/phoebebright/3061203
            if (d3.selectAll('.axis-label').empty()) {//prevent redraw
                svg.append("text") //x axis label
                    .classed('axis-label', true)
                    .attr("text-anchor", "middle")
                    .attr("transform", `translate(${w/2 - padding/2},${h})`)
                    .text("X (Red Axis) Values");
                svg.append("text") //y axis label
                    .classed('axis-label',true)
                    .attr("text-anchor","middle")
                    .attr("transform", `translate(${padding*0.75/2},${h/2})rotate(-90)`)
                    .text("Y (Green Axis) Values");
            }
            fulfill(); //done
        });
    };
};

let Kiviat = function (parent, position,sensorNumber,scales, options){
    let self = this;
    options = options || {};
    //kiviat dimensions
    //pass in size via parameter, based on pixel distance in image (not svg)?
    let w = options.w || 50, h = options.h || 50;
    let center = {
        x: w/2,
        y: h/2
    };
    //used to draw the lines on the graph
    let lineFunction = d3.line()
        .x(function (d) { return d.x; })
        .y(function (d) { return d.y; });

    //create group on parent
    parent.append('g').classed('kiviat', true).attr('id',`sensor-${sensorNumber}`)
        .attr("transform", `translate(${position.x},${position.y}) scale(${options.scale || 1})`);
    self.graph = d3.select(`#sensor-${sensorNumber}`);

    scales = scales || {}, axes = {};
    //default point position along each respective axis 
    let pointPositions = {
        'Appluimonia': {position: h/2, value: 0}, //h/2 to 0
        'Chlorodinine': {position: w/2, value: 0}, //w/2 to w
        'Methylosmolene': {position: h/2, value: 0}, //h/2 to h
        'AGOC-3A': {position: w/2, value: 0} //w/2 to 0
    };

    function drawAxes(){
        let lineData = {
            'Appluimonia': [{x:w/2,y:h/2}, {x:w/2, y:0}], //h/2 to 0
            'Chlorodinine': [{x:w/2,y:h/2}, {x:w, y:h/2}], //w/2 to w
            'Methylosmolene': [{x:w/2,y:h/2}, {x:w/2, y:h}], //h/2 to h
            'AGOC-3A': [{x:w/2,y:h/2}, {x:0, y:h/2}] //w/2 to 0
        };

        for(let chemical in lineData){
            // console.log(chemical,lineData[chemical]);
            axes[chemical] = {
                regular: self.graph.append('path')
                    .data([lineData[chemical]])
                    .attr('class', 'axis')
                    .attr('d', lineFunction)
                    .attr('id', `${chemical}-axis`),
                helper: self.graph.append('path')
                    .data([lineData[chemical]])
                    .attr('class', 'axis-mouseover')
                    .attr('d', lineFunction)
                    .attr('id', `${chemical}-${sensorNumber}-axis-helper`)
                    .attr('value', 0)
                    .on('mouseenter',function(d,i){
                        // console.log("entered");
                        let value = d3.select(this).attr('value');
                        tooltip.setContent(`${chemical}<br>${value} ppm`);
                        tooltip.showAt(d3.event.pageX, d3.event.pageY);
                    }).on('mouseleave',function(){
                        tooltip.hide();
                        // console.log('left');
                    })
            }
        }
        
    }

    self.init = function(){        
        //all dimensions are relative to top left corner of group (0,0)
        scales.Appluimonia = (scales.Appluimonia || d3.scaleLinear().domain([0, 2])).range([h/2,0]); //top axis;

        scales.Chlorodinine = (scales.Chlorodinine || d3.scaleLinear().domain([0,2])).range([w/2,w]); //right axis

        scales.Methylosmolene = (scales.Methylosmolene || d3.scaleLinear().domain([0,2])).range([h/2,h]); //bottom axis
        
        scales['AGOC-3A'] = (scales['AGOC-3A'] || d3.scaleLinear().domain([0,2])).range([w/2,0]); //left axis

        //draw axes
        drawAxes();

        //put sensor number
        self.graph.append('text').classed('sensor-label',true).attr('x',w*0.1).attr('y',h*0.1).text(sensorNumber);

        //draw initial point positions
        let points = [];
        for (let c in pointPositions) {
            let translation = get_translation(c, pointPositions[c].position);
            points.push(translation);
        }

        points.push(points[0]);
        self.graph.append('path').data([points])
            .attr('d', lineFunction)
            .classed('current', true)
            .attr('id',`data.${sensorNumber}`);

    };

    self.update = function(data){
        //sample data set
        data = data || [
            { Chemical: 'Appluimonia', Reading: 1.25 },
            { Chemical: 'Chlorodinine', Reading: 1.8 },
            { Chemical: 'Methylosmolene', Reading: 0.75 },
            { Chemical: 'AGOC-3A', Reading: 1 },
        ];

        //convert data to object keyed by chemical name
        let convertedData = {};
        for(let d of data){
            convertedData[d.Chemical] = d.Reading;
            d3.select(`#${d.Chemical}-${sensorNumber}-axis-helper`).attr('value',d.Reading);
        }

        for (let c in pointPositions){
            if(!convertedData[c]){
                //default to 0 when no data is given
                pointPositions[c] = {
                    position: 0,
                    value: 0
                }; 
            }else{
                pointPositions[c] = {
                    position: scales[c](convertedData[c]),
                    value: convertedData[c]
                }
            }
        }

        draw();
    }

    function get_translation(name, value) {
        switch (name) {
            case 'Appluimonia':
            case `Methylosmolene`: return {x:w/2, y:value}; //x stays constant, as we're moving along y axis

            case 'Chlorodinine':
            case 'AGOC-3A': return {x:value, y:h/2}; //y stays constant, as we're moving along x axis

            default: return {x:0, y:0};
        }
    }

    function draw(){   
        let points = [];
        for(let c in pointPositions){
            let translation = get_translation(c,pointPositions[c].position);
            points.push(translation);
        }

        points.push(points[0]);
        self.graph.select(`.current`).data([points])
            .transition().duration(200)
            .attr('d', lineFunction)
    }
}