`use strict`;

let Graph = function(){
    let self = this;
    let min = d3.min([window.innerWidth, window.innerHeight]);
    let w = min, h = min;
    let padding = 30;
    let svg = d3.select('#graph').append('svg').attr('width',w).attr('height',h);
    let scales = {}, axes = {};
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
    let factoryLocations = [
        { name:'Roadrunner Fitness Electronics', location: [89,27]},
        { name:'Kasios Office Furniture', location: [90,21]},
        { name:'Radiance ColourTek', location: [109,26]},
        { name:'Indigo Sol Boards', location: [120,22]}
    ];
    self.init = function(){
        scales.x = d3.scaleLinear()
            // .domain([50, 125]) 
            .domain([0, 200]) 
            .range([padding, w - padding * 2]); //add padding to not go outside bounds
        scales.y = d3.scaleLinear()
            // .domain([0, 75])
            .domain([0, 200]) 
            .range([h - padding, padding]); //[h,0] makes it so that smaller numbers are lower; add padding to not go outside bounds

        axes.x = d3.axisBottom(scales.x);
        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', 'translate(0,' + (h - padding) + ')') //move x-axis to bottom of image
            .call(axes.x);

        axes.y = d3.axisLeft(scales.y);
        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', 'translate(' + padding + ',0)') //move y-axis right to have readable labels
            .call(axes.y);
    }

    self.drawFactories = function(){
        let factories = svg.selectAll('.factory').data(factoryLocations);
        factories.exit().remove(); //remove excess

        //update current
        factories.attr('x', function (d) { return scales.x(d.location[0]); })
            .attr('y', function (d) { return scales.y(d.location[1]); });

        //create new as necessary
        factories.enter().append('rect').classed('factory', true)
            .attr('width', 10).attr('height', 10)
            .attr('x', function (d) { return scales.x(d.location[0]); })
            .attr('y', function (d) { return scales.y(d.location[1]); });
    }

    self.drawSensors = function(){
        let sensors = svg.selectAll('.sensor').data(sensorLocations);
        sensors.exit().remove(); //remove excess

        //update current
        sensors.attr('cx', function (d) { return scales.x(d.location[0]); })
            .attr('cy', function (d) { return scales.y(d.location[1]); });
        
        //create new as necessary
        sensors.enter().append('circle').classed('sensor',true)
            .attr('r',5)
            .attr('cx', function (d) { return scales.x(d.location[0]); })
            .attr('cy', function (d) { return scales.y(d.location[1]); });
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
    }
}