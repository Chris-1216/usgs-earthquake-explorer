var allEarthquakes = [];
var displayedEarthquakes = [];
var baseUrl = "https://earthquake.usgs.gov/fdsnws/event/1/";

function startIndexPage() {
    setDefaultDates();
    searchEarthquakes();
}

function setDefaultDates() {
    var endDate = new Date();
    var startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);
    document.getElementById("startDate").value = makeDateString(startDate);
    document.getElementById("endDate").value = makeDateString(endDate);
}

function makeDateString(dateValue) {
    var year = dateValue.getFullYear();
    var month = dateValue.getMonth() + 1;
    var day = dateValue.getDate();

    if (month < 10) {
        month = "0" + month;
    }

    if (day < 10) {
        day = "0" + day;
    }

    return year + "-" + month + "-" + day;
}

function addOneDay(dateText) {
    var dateValue = new Date(dateText + "T00:00:00");
    dateValue.setDate(dateValue.getDate() + 1);
    return makeDateString(dateValue);
}

async function searchEarthquakes() {
    var startDate = document.getElementById("startDate").value;
    var endDate = document.getElementById("endDate").value;
    var minMagnitude = document.getElementById("minMagnitude").value;
    var apiOrder = document.getElementById("apiOrder").value;

    if (startDate == "" || endDate == "") {
        showMessage("Please choose both a start date and an end date.", "error");
        return;
    }

    if (startDate > endDate) {
        showMessage("The start date must be before the end date.", "error");
        return;
    }

    document.getElementById("resultsBody").innerHTML = "<tr><td colspan='6'>Loading earthquakes...</td></tr>";
    showMessage("Searching the USGS API...", "good");

    var finalEndDate = addOneDay(endDate);
    var parameters = "starttime=" + startDate + "&endtime=" + finalEndDate + "&minmagnitude=" + minMagnitude + "&orderby=" + apiOrder;
    var queryUrl = baseUrl + "query?format=geojson&eventtype=earthquake&limit=50&" + parameters;
    var countUrl = baseUrl + "count?eventtype=earthquake&" + parameters;

    try {
        var countText = await getApiText(countUrl);
        var resultText = await getApiText(queryUrl);

        if (countText == "") {
            countText = "0";
        }

        document.getElementById("totalCount").innerHTML = countText;

        if (resultText == "") {
            allEarthquakes = [];
            displayedEarthquakes = [];
            displayResults();
            updateStats();
            showMessage("No earthquakes matched these search choices. Try a wider date range or a lower magnitude.", "good");
            return;
        }

        var dataObject = JSON.parse(resultText);

        if (dataObject.features) {
            allEarthquakes = dataObject.features;
        } else {
            allEarthquakes = [];
        }

        applyLocalControls();
        showMessage("Search complete. You can now filter or sort the results below.", "good");
    } catch (error) {
        allEarthquakes = [];
        displayedEarthquakes = [];
        displayResults();
        updateStats();
        document.getElementById("totalCount").innerHTML = "0";
        showMessage("Sorry, the earthquake data could not be loaded. Check your internet connection, browser shields, or search choices.", "error");
    }
}

async function getApiText(url) {
    var options = {
        method: "GET"
    };

    var response = await fetch(url, options);

    if (response.status == 204) {
        return "";
    }

    if (response.status != 200) {
        throw "API error";
    }

    var result = await response.text();
    return result;
}

function applyLocalControls() {
    var placeText = document.getElementById("placeFilter").value.toLowerCase().trim();
    var tsunamiChoice = document.getElementById("tsunamiFilter").value;
    var sortChoice = document.getElementById("localSort").value;
    var i;
    var current;
    var place;
    var tsunamiValue;

    displayedEarthquakes = [];

    for (i = 0; i < allEarthquakes.length; i++) {
        current = allEarthquakes[i];
        place = "";

        if (current.properties.place) {
            place = current.properties.place.toLowerCase();
        }

        tsunamiValue = current.properties.tsunami;

        if (placeText != "" && place.indexOf(placeText) == -1) {
            continue;
        }

        if (tsunamiChoice == "yes" && tsunamiValue != 1) {
            continue;
        }

        if (tsunamiChoice == "no" && tsunamiValue == 1) {
            continue;
        }

        displayedEarthquakes.push(current);
    }

    if (sortChoice == "place") {
        displayedEarthquakes.sort(comparePlace);
    }

    if (sortChoice == "depth") {
        displayedEarthquakes.sort(compareDepth);
    }

    if (sortChoice == "significance") {
        displayedEarthquakes.sort(compareSignificance);
    }

    displayResults();
    updateStats();
}

function comparePlace(a, b) {
    var placeA = "";
    var placeB = "";

    if (a.properties.place) {
        placeA = a.properties.place.toLowerCase();
    }

    if (b.properties.place) {
        placeB = b.properties.place.toLowerCase();
    }

    if (placeA < placeB) {
        return -1;
    }

    if (placeA > placeB) {
        return 1;
    }

    return 0;
}

function compareDepth(a, b) {
    var depthA = 0;
    var depthB = 0;

    if (a.geometry.coordinates[2]) {
        depthA = a.geometry.coordinates[2];
    }

    if (b.geometry.coordinates[2]) {
        depthB = b.geometry.coordinates[2];
    }

    return depthA - depthB;
}

function compareSignificance(a, b) {
    var sigA = 0;
    var sigB = 0;

    if (a.properties.sig) {
        sigA = a.properties.sig;
    }

    if (b.properties.sig) {
        sigB = b.properties.sig;
    }

    return sigB - sigA;
}

function displayResults() {
    var tableText = "";
    var i;
    var quake;
    var properties;
    var depth;
    var alertText;
    var magText;

    if (displayedEarthquakes.length == 0) {
        document.getElementById("resultsBody").innerHTML = "<tr><td colspan='6'>No earthquakes to display.</td></tr>";
        return;
    }

    for (i = 0; i < displayedEarthquakes.length; i++) {
        quake = displayedEarthquakes[i];
        properties = quake.properties;
        depth = quake.geometry.coordinates[2];
        alertText = properties.alert;
        magText = properties.mag;

        if (alertText == null) {
            alertText = "None";
        }

        if (magText == null) {
            magText = "N/A";
        } else {
            magText = Math.round(magText * 10) / 10;
        }

        depth = Math.round(depth * 10) / 10;

        tableText += "<tr>";
        tableText += "<td>" + magText + "</td>";
        tableText += "<td>" + safeText(properties.place) + "</td>";
        tableText += "<td>" + formatTime(properties.time) + "</td>";
        tableText += "<td>" + depth + " km</td>";
        tableText += "<td>" + alertText + "</td>";
        tableText += "<td><a class='btn btn-primary btn-xs' href='details.html?id=" + quake.id + "'>View Details</a></td>";
        tableText += "</tr>";
    }

    document.getElementById("resultsBody").innerHTML = tableText;
}

function updateStats() {
    var i;
    var largest = 0;
    var currentMag;

    for (i = 0; i < displayedEarthquakes.length; i++) {
        currentMag = displayedEarthquakes[i].properties.mag;
        if (currentMag > largest) {
            largest = currentMag;
        }
    }

    document.getElementById("displayedCount").innerHTML = displayedEarthquakes.length;
    document.getElementById("largestMagnitude").innerHTML = Math.round(largest * 10) / 10;
}

function showMessage(message, type) {
    var className = "good-message";

    if (type == "error") {
        className = "error-message";
    }

    document.getElementById("messageBox").innerHTML = "<div class='" + className + "'>" + message + "</div>";
}

function formatTime(milliseconds) {
    if (milliseconds == null) {
        return "Unknown";
    }

    var dateValue = new Date(milliseconds);
    return dateValue.toString();
}

function safeText(value) {
    if (value == null) {
        return "Unknown";
    }

    return value;
}

function startDetailPage() {
    var eventId = getEventIdFromUrl();

    if (eventId == "") {
        document.getElementById("detailContent").innerHTML = "No event id was provided.";
        return;
    }

    loadEarthquakeDetail(eventId);
}

function getEventIdFromUrl() {
    var search = window.location.search;
    var pieces;
    var pair;
    var i;

    if (search.length < 2) {
        return "";
    }

    search = search.substring(1);
    pieces = search.split("&");

    for (i = 0; i < pieces.length; i++) {
        pair = pieces[i].split("=");
        if (pair[0] == "id") {
            return pair[1];
        }
    }

    return "";
}

async function loadEarthquakeDetail(eventId) {
    var url = baseUrl + "query?format=geojson&eventid=" + eventId;

    try {
        var resultText = await getApiText(url);

        if (resultText == "") {
            document.getElementById("detailContent").innerHTML = "No details were found for this earthquake.";
            return;
        }

        var dataObject = JSON.parse(resultText);
        var quake;

        if (dataObject.type == "Feature") {
            quake = dataObject;
            displayDetail(quake);
        } else if (dataObject.features && dataObject.features.length > 0) {
            quake = dataObject.features[0];
            displayDetail(quake);
        } else {
            document.getElementById("detailContent").innerHTML = "No details were found for this earthquake.";
        }
    } catch (error) {
        document.getElementById("detailContent").innerHTML = "The earthquake details could not be loaded.";
    }
}

function displayDetail(quake) {
    var p = quake.properties;
    var c = quake.geometry.coordinates;
    var alertText = p.alert;
    var tsunamiText = "No";
    var detailText = "";

    if (alertText == null) {
        alertText = "None";
    }

    if (p.tsunami == 1) {
        tsunamiText = "Yes";
    }

    detailText += "<h2>" + safeText(p.title) + "</h2>";
    detailText += makeDetailRow("Magnitude", p.mag);
    detailText += makeDetailRow("Place", safeText(p.place));
    detailText += makeDetailRow("Time", formatTime(p.time));
    detailText += makeDetailRow("Updated", formatTime(p.updated));
    detailText += makeDetailRow("Latitude", c[1]);
    detailText += makeDetailRow("Longitude", c[0]);
    detailText += makeDetailRow("Depth", c[2] + " km");
    detailText += makeDetailRow("Alert Level", alertText);
    detailText += makeDetailRow("Tsunami Advisory", tsunamiText);
    detailText += makeDetailRow("Significance", p.sig);
    detailText += makeDetailRow("Felt Reports", safeText(p.felt));
    detailText += makeDetailRow("Status", safeText(p.status));
    detailText += makeDetailRow("Event Type", safeText(p.type));
    detailText += makeDetailRow("USGS Event Id", quake.id);

    if (p.url) {
        detailText += "<p><a class='btn btn-primary' href='" + p.url + "' target='_blank'>Open Official USGS Event Page</a></p>";
    }

    document.getElementById("detailContent").innerHTML = detailText;
}

function makeDetailRow(label, value) {
    return "<div class='detail-row'><span class='label-text'>" + label + ": </span>" + value + "</div>";
}
