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
            .domain([new Date(2016,11,1), new Date(new Date(2016,0,1)-1)])
            .range([(2*w/3)-padding,(w-padding)]);

        scales.monthScales = monthScales;

        //take every chemical scale and convert them to delta scales, where all input is output to a range of -1 and 1
        let chemical_names = ['Appluimonia', 'Chlorodinine', 'Methylosmolene', 'AGOC-3A'];
        for(let c of chemical_names){
            let [min,max] = options.scales[c].domain();
            let globalMax = Math.max(Math.abs(max),Math.abs(min)); //get value furthest from 0 for uniform vertical scaling
            scales[c] = d3.scaleLinear().domain([globalMax,globalMax]).range(svgRange.y);
            // console.log(c,[min,max],scales[c].domain());
        }

        //used for debugging positions
        scales.verticalScale = d3.scaleLinear().domain([-1,1]).range(svgRange.y);

        //create vertical axes
        for(let c of chemical_names){
            axes[c] = d3.axisLeft(scales[c]).ticks(3);
        }

        //draw 0 line
        svg.append('path')
            .datum([new Vector(padding,scales.verticalScale(0)),new Vector(w-padding,scales.verticalScale(0))])
            .attr('d',line);
        
        self.changeChemical(selectedChemical);
        
    };

    self.changeChemical = (newChemical) => {
        let chemical_names = ['Appluimonia', 'Chlorodinine', 'Methylosmolene', 'AGOC-3A'];
        if(chemical_names.indexOf(newChemical) === -1){
            throw new Error(`Chemical ${newChemical} is not found.`);
        }else{
            selectedChemical = newChemical;
        }

        console.log("Selected chemical is now",selectedChemical);
        d3.selectAll('.delta-axis-y').remove();

        //plot axis
        let yAxis = svg.append('g')
            .classed('axis', true)
            .classed('delta-axis-y', true)
            .attr('transform', `translate(${padding},0)`)
            .call(axes[selectedChemical]);
    };

    self.update = (data) => {

    };


    
}