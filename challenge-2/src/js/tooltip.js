//based on http://bl.ocks.org/d3noob/a22c42db65eb00d4e369

var Tooltip = function(){
    let self = this;
    // self.div = d3.select('div.tooltip').style('opacity',0);

    function showAt(x,y){
        // console.log('received coords',x,y);
        let div = d3.select('div.tooltip#vis');
        div.style('opacity', 1)
            .style('left', `${x+15}px`)
            .style('top',  `${y-35}px`);
    }
    self.showAt = showAt;

    function setContent(content){
        // console.log('received content',JSON.stringify(content,null,2));
        let div = d3.select('div.tooltip');
        div.html(content);
    }
    self.setContent = setContent;

    function hide(){
        // console.log('hiding');
        let div = d3.select('div.tooltip');
        div.style('opacity',0);
    }
    self.hide = hide;

    //empty message removes events
    function setEvents(target,message){
        if (!message || message.length === 0) {
            target.on('mouseenter', undefined)
                .on('mouseleave', undefined);
        } else {
            target.on('mouseenter', function () {
                setContent(message);
                showAt(d3.event.pageX, d3.event.pageY);
            }).on('mouseleave', function () {
                hide();
            });
        }    
    }
    self.setEvents = setEvents;
};