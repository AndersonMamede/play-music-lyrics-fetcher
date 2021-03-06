var lyricsSyncInterval;
var syncedLyricsWithTiming;
var songTimingDelay=0;
var autoScroll=true;
var showTimedLyrics=true;
var artistTrack;
/*
 Counter for the number of tries to fetch lyrics taken (usefull for youtube,
 where sometimes the artist/track name are switched. The script will try to
 switch them twice, this way the popup for the user to insert artist/track
 name has the placeholder fields displayed correctly)
*/
var lyricsFetchTries = 0;

var examples = [["Led Zeppelin","Kashmir"],
				["Queen","Bohemian Rhapsody"],
				["Kiss","Strutter"],
				["Pearl Jam","Even Flow"],
				["Bob Dylan","Like a Rolling Stone"],
				["John Lennon","Imagine"],
				["The Beatles","Hey Jude"],
				["Nirvana","Smells Like Teen Spirit"],
				["U2","One"],
				["Dire Straits","Sultans of Swing"],
				["Bon Jovi","Livin' on a Prayer"],
				["Led Zeppelin","Stairway to Heaven"],
				["Black Sabbath","Paranoid"],
				["Iron Maiden","The Number of the Beast"],
				["Sex Pistols","Anarchy in the UK"],
				["Aerosmith","Dream On"]];

chrome.storage.sync.get('timedLyrics', function(obj) {
	showTimedLyrics = obj.timedLyrics;
});
chrome.storage.sync.get('autoScroll', function(obj) {
	autoScroll = obj.autoScroll;
	if(!autoScroll && showTimedLyrics)$("#top_bar_autoscroll").css("display","inherit");
	else $("#top_bar_autoscroll").css("display","none");
});

function fetchLyrics (art,mus) {
	lyricsFetchTries++;
	$("body").css("min-width","10px");
	$("#status").css("padding","10px");
	$("#top_bar").css("display","none");
	$("#status").html("<i>Fetching lyrics...</i>");
	chrome.storage.local.get(art + mus, function(obj) {

		if(obj[art + mus]){
			console.log("CACHED Lyrics found");
			validateLyrics(obj[art + mus], art, mus);
			return true;
		}

		var url = "http://api.vagalume.com.br/search.php"
			+"?art="+encodeURIComponent(art)
			+"&mus="+encodeURIComponent(mus)
			+"&apikey=660a4395f992ff67786584e238f501aa";

		// Check if browser supports CORS - http://www.w3.org/TR/cors/
		if (!jQuery.support.cors) {
			url += "&callback=?";
		}

		console.log("Fetching lyrics for \""+art+"\" > \""+mus+"\" ...");

		jQuery.getJSON(url,function(data) {
			// cache write
			var cachedObj = {}
			cachedObj[art + mus] = data;
			chrome.storage.local.set(cachedObj);
			console.log("LYRIC STORED ON CACHE");

			//Continue
			validateLyrics(data, art, mus);
		}).fail(function(){
			// Something went wrong with the request. Alert the user
			$("#status").html("There was an error trying to reach the API.");
		});

	});
}


function validateLyrics(data,art,mus){

	if (data.type == 'exact' || data.type == 'aprox' ) {
		if(!data.mus[0].text)data.mus[0].text="No lyrics found for this song. Is it instrumental?";
		if(showTimedLyrics){
			chrome.tabs.getSelected(null, function(tab) {
				chrome.tabs.sendMessage(tab.id, {query:"getPosition" },
					function(response) {
						if(response.position!=-1)fetchTiming(data);//BUGANDO TUDO VÉI
						else showLyrics(data);
					}
				);
			});

		}
		else showLyrics(data);
	} else if(lyricsFetchTries<3){
		fetchLyrics (mus,art);
	}else if (data.type == 'song_notfound') {
		// Song not found, but artist was found
		// You can list all songs from Vagalume here
		showInputFields("We could not find song <b>"+mus+"</b> by "+data.art.name, data.art.name, mus);
		console.log("We could not find song "+mus+" by "+data.art.name);
	} else {
		// Artist not found
		showInputFields("We could not find artist <b>"+art+"</b>", art, mus);
		console.log("We could not find artist "+art);
	}
}

function fetchTiming(trackData){
	$("#top_bar").css("display","none");
	$("#status").html("<i>Fetching timing...</i>");

	chrome.storage.local.get(trackData.mus[0].id+"timing", function(obj) {

		if(obj[trackData.mus[0].id+"timing"]){
			console.log("CACHED Timing found");
			validateTiming(trackData, obj[trackData.mus[0].id+"timing"]);
			return true;
		}

	chrome.tabs.getSelected(null, function(tab) {
		chrome.tabs.sendMessage(tab.id, {query:"getPosition" },
			function(response) {
				var url = "https://app2.vagalume.com.br/ajax/subtitle-get.php?action=getBestSubtitle"
					+"&pointerID="+trackData.mus[0].id
					+"&duration="+response.length;

				// Check if browser supports CORS - http://www.w3.org/TR/cors/
				if (!jQuery.support.cors) {
					url += "&callback=?";
				}

				console.log("Fetching timing...");
				jQuery.getJSON(url,function(timingData) {
					// cache write
					var cachedObj = {}
					cachedObj[trackData.mus[0].id+"timing"] = timingData;
					chrome.storage.local.set(cachedObj);
					console.log("TIMING STORED ON CACHE");

					//Continue
					validateTiming(trackData, timingData);
				}).fail(function(){
					// Something went wrong with the request. Alert the user
					$("#status").html("There was an error trying to reach the API.");
				});
			}
		);
	});
});
}

function validateTiming(trackData, timingData){
	if (timingData.subtitles) {
		showLyrics(trackData, timingData);
	} else {
		// Subtitle not found
		console.log("Timing not found");
		showLyrics (trackData);
	}
}


function showLyrics (trackData, timingData) {
	songTimingDelay=0;
	$("body").css("min-width","350px");
	$("#status").css("padding-top","50px");
	artistTrack=trackData.art.name+trackData.mus[0].name;
	var top = "<h2>"+trackData.mus[0].name + "</h2><br/><i>by <h4>" +trackData.art.name+"</h4></i><br/><br/>";

	lyricsSyncInterval = setInterval(timeCheck, 200);

	if(timingData){
		// Timing found, show awesome lyrics
		$("#status").html(top);
		syncedLyricsWithTiming = timingData.subtitles[0].text_compressed;
		console.log("YoutTube synced video ID: "+timingData.subtitles[0].yt_vinc);
		for(var i=0; i<syncedLyricsWithTiming.length; i++){
			$("#status").html($("#status").html() + "<p class=\"lyrics_line\">"+syncedLyricsWithTiming[i][0].trim()+"</p>");
		}

		$(window).bind('mousewheel DOMMouseScroll mousedown', function(event){
			var container = $("#top_bar");
			if (!container.is(event.target) // if the target of the click isn't the container...
				&& container.has(event.target).length === 0) // ... nor a descendant of the container
			{
				$( 'html, body' ).stop( true );
				autoScroll=false;
				$("#top_bar_autoscroll").css("display","inherit");
			}
		});
		chrome.tabs.getSelected(null, function(tab) {
			chrome.tabs.sendMessage(tab.id, {query:"getDelay"},
				function(response) {
					if(response && response.artistTrack == artistTrack){
						songTimingDelay=response.delay;
						updateFormattedTimingDelay();
					}
				}
			);
		});

		$("#top_bar_song_delay").css("display", "inherit");
		updateFormattedTimingDelay();

		$("#top_bar_settings").off("click");
		$("#top_bar_new_window").off("click");
		$("#top_bar_search").off("click");
		$("#top_bar_song_delay_increase").off("mousedown").unbind("mouseup mouseleave");
		$("#top_bar_song_delay_decrease").off("mousedown").unbind("mouseup mouseleave");
		$("#top_bar").unbind("mousewheel");
		$("#top_bar_song_delay_status").unbind("mousewheel dblclick");
		$("#top_bar_autoscroll").off("click");

		$('#top_bar_song_delay_increase').mousedown(function() {
			songTimingDelay+=.5; updateFormattedTimingDelay();
			timeoutId = setTimeout(function(){intervalId = setInterval(function(){songTimingDelay+=.5; updateFormattedTimingDelay()}, 100);},500);
		}).bind('mouseup mouseleave', function() {
			if(typeof intervalId !== 'undefined')clearInterval(intervalId);
			if(typeof timeoutId !== 'undefined')clearTimeout(timeoutId);
		});
		$('#top_bar_song_delay_decrease').mousedown(function() {
			songTimingDelay-=.5; updateFormattedTimingDelay();
			timeoutId = setTimeout(function(){intervalId = setInterval(function(){songTimingDelay-=.5; updateFormattedTimingDelay()}, 100);},500);
		}).bind('mouseup mouseleave', function() {
			if(typeof intervalId !== 'undefined')clearInterval(intervalId);
			if(typeof timeoutId !== 'undefined')clearTimeout(timeoutId);
		});
		$('#top_bar').bind('mousewheel', function(event) {event.preventDefault();});
		$('#top_bar_song_delay_status').bind('mousewheel', function(event) {
			if (event.originalEvent.wheelDelta >= 0) {
				songTimingDelay+=.5; updateFormattedTimingDelay();
			}
			else {
				songTimingDelay-=.5; updateFormattedTimingDelay();
			}
		}).bind('dblclick',function(){
				songTimingDelay=0; updateFormattedTimingDelay();
		});

		$("#top_bar_autoscroll").click(function(){autoScroll=true; $("#top_bar_autoscroll").css("display","none")});
	} else {
		// No timing found, simply print lyrics text
		$("#status").html(top+trackData.mus[0].text);
	}
	$("#status").css("white-space", "pre");
	if($('#status').width() > 700)
		$("#status").css("white-space", "pre-line");
	$("#top_bar").css("display","inherit");
	$("#top_bar_new_window").click(function(){openPopup(trackData.art.name, trackData.mus[0].name, trackData.mus[0].text);});
	$("#top_bar_search").click(function(){showInputFields("Wrong lyric?<br/>Please fill the form above and try a new search.", trackData.art.name, trackData.mus[0].name);});
	$("#top_bar_settings").click(function(){
		//chrome.tabs.create({ 'url': './pages/options.html' }); //Old behavior
		chrome.tabs.create({ 'url': 'chrome://extensions/?options=' + chrome.runtime.id }); //New, cleaner behavior
	});
}
function updateFormattedTimingDelay(){
	if(songTimingDelay==0)$("#top_bar_delay img").attr("src","../images/bt_delay.png");
	else if(songTimingDelay<0)$("#top_bar_delay img").attr("src","../images/bt_delay_fwd.png");
	else if(songTimingDelay>0)$("#top_bar_delay img").attr("src","../images/bt_delay_bwd.png");
	$("#top_bar_song_delay_status").text((songTimingDelay%1==0?songTimingDelay+'.0':songTimingDelay)+'s');
	chrome.tabs.getSelected(null, function(tab) {
		chrome.tabs.sendMessage(tab.id, {query:"setDelay", delay:{delay:songTimingDelay, artistTrack:artistTrack}});
	});
}

function showInputFields(popupTitle, artist, track){
	$("#top_bar").css("display","none");
	var sortedExample = examples[Math.floor(Math.random()*examples.length)];
	$("#fix_song_info").css("display","inherit");
	$("#status").css("display","none");
	$("#fix_song_info_title").html(popupTitle);
	$("#fix_song_info_form_artist").attr("value", artist).attr("placeholder", 'e.g '+sortedExample[0]);
	$("#fix_song_info_form_track").attr("value", track).attr("placeholder", 'e.g '+sortedExample[1]);
	$('#fix_song_info_form').on('submit', function () {
		if(validateFormLength()){
			$("#fix_song_info").css("display","none");
			$("#status").css("display","inherit");
			fetchLyrics($("#fix_song_info_form_artist").val(), $("#fix_song_info_form_track").val());
		}
		return false; // para cancelar o envio do formulario
	});
	$('#fix_song_info_form_artist').keyup(validateFormLength);
	$('#fix_song_info_form_track').keyup(validateFormLength);
	validateFormLength();
}

function validateFormLength(){
	if($('#fix_song_info_form_artist').val().length>0 && $('#fix_song_info_form_track').val().length>0){
		$('#fix_song_info_form_submit').addClass('active');
		return true;
	} else {
		$('#fix_song_info_form_submit').removeClass('active');
		return false;
	}
}


function timeCheck(){
chrome.tabs.getSelected(null, function(tab) {
	chrome.tabs.sendMessage(tab.id, {query:"getPosition" },
		function(response) {
			if(response.newSong)restart();
			if(response.position)refreshLyricsPositionOnScreen(response.position);
		}
	);
});

}

function refreshLyricsPositionOnScreen(position){
	try{
		if(syncedLyricsWithTiming == undefined)return;
		for(var i=syncedLyricsWithTiming.length-1; i>=0; i--){
			if((syncedLyricsWithTiming[i][1]<position-songTimingDelay)
				||i==0){
				$( ".lyrics_line" ).removeClass( "current" );
				$( ".lyrics_line:eq("+i+")" ).addClass( "current" );
				if(autoScroll)
				$('html, body').animate({
					scrollTop: $(".current").offset().top-140
				}, 100);
				break;
			}
		}
	}catch(err){
		console.log(err.message);
	}
}
