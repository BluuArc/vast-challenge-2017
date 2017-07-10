`use strict`;

var tooltip = tooltip || new Tooltip();

let TimeSlider = function(options){
    options = options || {};
    let self = this;
    let w = 800, h = 50;
    let padding = 12;
    let svg = d3.select('#timestamp-brush-slider').append('svg').classed('svg-content', true)
        .attr('viewBox', `0 0 ${w} ${h}`).attr('preserveAspectRatio', `xMinYMin meet`);
    let scales = {}, axes = {};;
    let lines = [];
    let verbose = options.verbose || false;
    const chemical_names = ['Appluimonia', 'Chlorodinine', 'Methylosmolene', 'AGOC-3A'];

    //default selections
    let selectedSensor = 'sensor1';
    let selectedChemical = 'Appluimonia'; 

    let line = d3.line()
        .x((d) => { return d.x; }).y((d) => { return d.y; });

    function drawPointAt(x, y) {
        if (x instanceof Vector) {
            y = x.y;
            x = x.x;
        }

        return svg.append('circle')
            .attr('r', 5)
            .attr('cx', x)
            .attr('cy', y);
    }

    self.init = function(options){
        // options = options || {};
        // let optionScales = options.scales || {
        //     Appluimonia: {},
        //     Chlorodinine: {},
        //     Methylosmolene: {},
        //     'AGOC-3A': {},
        // };

        let svgRange = {
            x: [padding, w-padding],
            y: [padding, h-padding]
        };

        //separate month scales into thirds, one for each month
        let monthScales = {};
        monthScales['April 2016'] = d3.scaleTime()
            .domain([new Date(2016,3,1), new Date(new Date(2016,4,1)-1)])
            .range([padding,(w/3)-padding]);
        monthScales['August 2016'] = d3.scaleTime()
            .domain([new Date(2016, 7, 1), new Date(new Date(2016, 8, 1) - 1)])
            .range([(w/3)-padding, (2*w/3)-padding]);
        monthScales['December 2016'] = d3.scaleTime()
            .domain([new Date(2016,11,1), new Date(new Date(2017,0,1)-1)])
            .range([(2*w/3)-padding,(w-padding)]);

        scales.monthScales = monthScales;

        //take every chemical scale and convert them to delta scales, where all input is output to a range of -1 and 1
        // let chemical_names = ['Appluimonia', 'Chlorodinine', 'Methylosmolene', 'AGOC-3A'];
        for(let c of chemical_names){
            let [min,max] = options.scales[c].domain();
            let globalMax = Math.max(Math.abs(max),Math.abs(min)); //get value furthest from 0 for uniform vertical scaling
            scales[c] = d3.scaleLinear().domain([globalMax,globalMax]).range(svgRange.y);
            // console.log(c,[min,max],scales[c].domain());
        }

        //used for debugging positions
        scales.verticalScale = d3.scaleLinear().domain([-1,1]).range(svgRange.y);

        //draw background
        svg.append('rect').classed('slider-background',true)
            .attr('width',w-padding*2).attr('height',h-padding*2)
            .attr('x',padding).attr('y',padding);


        drawAxes();
        // drawBrush();
    };

    function drawAxes(){
        let group = svg.append('g').classed('delta-axes',true);

        //create vertical axes
        for (let c of chemical_names) {
            axes[c] = d3.axisLeft(scales[c]).ticks(3);
        }

        //draw 0 line
        group.append('path').classed('axis',true)
            .datum([new Vector(padding, scales.verticalScale(0)), new Vector(w - padding, scales.verticalScale(0))])
            .attr('d', line)
            .attr('stroke','black');


        //draw left axis
        group.append('g')
            .classed('axis', true)
            .classed('delta-axis-y', true)
            .attr('transform', `translate(${padding},0)`)
            .call(axes[selectedChemical]);

        //create horizontal axes
        let monthScales = scales.monthScales;
        for (let m in monthScales) {
            axes[m] = d3.axisBottom(monthScales[m])
                .ticks(d3.timeWeek)
                .tickPadding(0);
            //draw bottom axes
            group.append('g')
                .classed('axis', true)
                // .classed('axis-grid',true)
                .attr('transform', `translate(0,${h - padding})`)
                .call(axes[m])

            //draw daily dividers
            // group.append('g')
            //     .classed('axis', true).classed('minor-grid', true)
            //     .attr('transform', `translate(0,${h - padding})`)
            //     .call(d3.axisBottom(monthScales[m])
            //         .ticks(d3.timeDay)
            //         .tickSize(-h + padding * 2)
            //         .tickFormat(() => { return null; }))
            //     .selectAll('.tick').classed('tick-minor', true);
            //draw monthly dividers
            //based on https://bl.ocks.org/mbostock/6232537
            group.append('g')
                .classed('axis', true).classed('grid', true)
                .attr('transform', `translate(0,${h - padding})`)
                .call(d3.axisBottom(monthScales[m])
                    .ticks(d3.timeMonth)
                    .tickSize(-h + padding * 2)
                    .tickFormat(() => { return null; }));

            //draw top line
            group.append('g').classed('axis', true)
                .attr('transform', `translate(0,${padding})`)
                .call(d3.axisBottom(monthScales[m])
                    .ticks(d3.timeMonth)
                    .tickSize(0)
                    .tickFormat(() => { return null; }));

        }
        
    }

    self.changeChemical = (newChemical) => {
        // let chemical_names = ['Appluimonia', 'Chlorodinine', 'Methylosmolene', 'AGOC-3A'];
        if(chemical_names.indexOf(newChemical) === -1){
            throw new Error(`Chemical ${newChemical} is not found.`);
        }else{
            selectedChemical = newChemical;
        }

        console.log("Selected chemical is now",selectedChemical);

    };

    //data should have 2 fields: chemical and delta
    //chemical is a string with the chemical name
    //sensor is a string with the sensor name
    //delta should be in the same format as challenge2.data.delta
    self.update = (data) => {

    };


    
}