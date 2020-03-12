console.log('page chargée');

/* ********************************************************************************** */
/*                  PARAMETRAGE GRAPHIQUE 1 (diagramme en baton)                      */
/* ********************************************************************************** */

let margin = {top: 10, right: 30, bottom: 30, left: 60},
    width = 760 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

let x = d3.scaleBand()
    .range([0, width])
    .padding(0.1);

let y = d3.scaleLinear()
    .range([height, 0]);

// append the svg object to the body of the page
let svg = d3.select("#graphique_1")
  .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform",
          "translate(" + margin.left + "," + margin.top + ")");


/* ********************************************************************************** */
/*                  PARAMETRAGE GRAPHIQUE 2 (courbe d'évolution)                      */
/* ********************************************************************************** */

// COURBE EVOLUTION
// 1. Créer les dimensions du conteneur qui va accueillir le graphique 
let marginEv = {top: 50, right: 50, bottom: 50, left: 50}
  , widthEv = 500 - marginEv.left - marginEv.right // Use the window's width 
  , heightEv = 300 - marginEv.top - marginEv.bottom; // Use the window's height

// 2. Créer les axes et leur attribuer les unités
let x2 = d3.scaleTime().range([0, widthEv]);
let y2 = d3.scaleLinear().range([heightEv, 0]);

let valueline = d3.line()
                  .x(d => { return x2(d.key)})
                  .y(d => { return y2(d.value)})

// 3. Ajouter un élément svg reprenant les dimensions du contenur déclaré en 1.
var svg2 = d3.select("#graphique_2").append("svg")
  .attr("width", widthEv + marginEv.left + marginEv.right)
  .attr("height", heightEv + marginEv.top + marginEv.bottom)
  .append("g")
  .attr("transform",
        "translate(" + marginEv.left + "," + marginEv.top + ")");

// tooltip (commun aux deux graphiques)
const div = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

function mousemove() {
  div.style("left", (d3.event.pageX - 50) + "px")
    .style("top", (d3.event.pageY - 40) + "px");
};


/* ********************************************************************************** */
/*                            PARAMETRAGE CARTE LEAFLET                               */
/* ********************************************************************************** */

let map = L.map("map")

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y  }.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);


/* ********************************************************************************** */
/*                                CHARGEMENT FICHIER                                  */
/* ********************************************************************************** */

// chemin et nom du ficher 
let filePath = "./feuxUSA.csv";

// décompte du temps de chargement du fichier
let t0 = performance.now()
let temps;

// chargement du fichier
d3.csv(filePath)
.then(data => {
  // décompte de chargement 
  let t1 = performance.now();
  temps = (t1 - t0)/1000;
  
  // affichage du temps nécessaire au chargement du fichier
  console.log("Le fichier"+filePath+" a été chargé en : "+temps+"secondes");

  // 1er jeu de données pour le premier graphique : aggrégation par État pour avoir le nombre d'incendies par état
  let data2 = d3.nest()
  .key(d => { return d.STATE})
  .entries(data)
  .sort((a, b) => { return d3.descending(a.values.length, b.values.length); })

  // Centrer la carte sur les coordonnées ci-dessous
  latlong = data[0]
  map.setView([latlong.LATITUDE,latlong.LONGITUDE],2)
  
  // intégration valeurs des axes du graphique 1 
  x.domain(data2.map(d => {return d.key}))
  y.domain([0, d3.max(data2, d => {return d.values.length})]);
  
  /* ********************************************************************************** */
  /*                            CREATION DU GRAPHIQUE  1                                */
  /* ********************************************************************************** */


  svg.append("g")
  .attr("transform", "translate(0," + height + ")")
  .call(d3.axisBottom(x).tickSize(0))
  .selectAll("text")	
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-65)");

  // Ajout de l'axe Y au SVG avec 6 éléments de légende en utilisant la fonction ticks (sinon D3JS en place autant qu'il peut).
  svg.append("g")
    .call(d3.axisLeft(y).ticks(6));
  
    // Ajout des bars en utilisant les données agrégées de data2
  // La largeur de la barre est déterminée par la fonction x
  // La hauteur par la fonction y en tenant compte de la population
  // La gestion des events de la souris pour le popup
  svg.selectAll(".bar")
      .data(data2)
  .enter().append("rect")
      .attr("class", "bar")
      .attr("x", d => { return x(d.key); }) // en x, renvoie le nom de l'état
      .attr("width", x.bandwidth())
      .attr("y", d => { return y(d.values.length); }) /* en y, le nombre d'incendies */
      .attr("height", d => { return height - y(d.values.length); })					
      .on("mouseover", function(d) { /* au passage de la souris .... */
          div.transition()        /* affiche un tooltip */
              .duration(50)      
              .style("opacity", .9);
          div.html( d.values.length + " feux")
              .style("left", (d3.event.pageX + 10) + "px")     
              .style("top", (d3.event.pageY - 50) + "px");
      })
      .on("mousemove",mousemove) /* fais bouger la tooltip en suivant le mouvement de la souris */
      .on("mouseout", function(d) {
          div.transition()
              .duration(500)
              .style("opacity", 0);
      }).on("click", d => { /* au click ... */

        // réinitialisation de la carte (nécesssaire pour ne pas superposer à chaque changement d'état les données)
        map.eachLayer(function (layer) {
          if(layer._url == undefined) {
            map.removeLayer(layer);
          };
        });
      
        let fires = d.values;        
        
        map.flyTo([fires[0].LATITUDE, fires[0].LONGITUDE],5)

        /* Création d'un tableau vide, qui va accueillir les latitudes et longitudes des points d'incendies */
        heatMapData = [];

        fires.forEach(feature => {          
          let lat = feature.LATITUDE
          let lon = feature.LONGITUDE
          heatMapData.push(L.latLng(lat,lon))
        });

        /* génération de la carte de chaleur */
        let heatmap = L.heatLayer(heatMapData, {maxZoom: 12})
        map.addLayer(heatmap)

      /* ********************************************************************************** */
      /*                            CREATION DU GRAPHIQUE 2                                 */
      /* ********************************************************************************** */

        // nouveau jeu de données à utiliser
        /* agrégation par année uniquement sur l'état sélectionné dans le graphique 1 */
        nb_year = d3.nest()
                    .key(d => { return d.YEAR})
                    .rollup(d => { return d.length; })
                    .entries(fires)
                    .sort((a, b) => { return d3.ascending(a.key, b.key); })
                
        // régler les axes
        x2.domain(d3.extent(nb_year, d => { return d.key; }));
        y2.domain(d3.extent(nb_year, d => { return d.value; }));

        /* trace la courbe sur le graphique */
        path = svg2
          .append("path")
          .data([nb_year])
          .attr("class", "line")
          .attr("d", valueline)
          .on("mouseover", function(d) {
            div.transition()        
                .duration(50)      
                .style("opacity", .9);
            div.html( d.value + " feux")
                .style("left", (d3.event.pageX + 10) + "px")     
                .style("top", (d3.event.pageY - 50) + "px");
        })
        .on("mousemove",mousemove);

        // animation courbe d'évolution
        var totalLength = path.node().getTotalLength();
        
        path
        .attr("stroke-dasharray", totalLength + " " + totalLength)
        .attr("stroke-dashoffset", totalLength)
        .transition()
          .duration(1000)
          .ease(d3.easeLinear)
          .attr("stroke-dashoffset", 0)

        // Ajoute ou redimensionne l'axe en x en fonction des données
        svg2.append("g")
          .attr("transform", "translate(0," + heightEv + ")")
          .call(d3.axisBottom(x2));

        // Ajoute ou redimensionne l'axe en y en fonction des données
        svg2.append("g")
          .call(d3.axisLeft(y2));
        })
});

/* WOOOF  */