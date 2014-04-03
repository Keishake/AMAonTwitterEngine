$ ->

  socket = io.connect "http://#{socketioUrl}"
  hashTweetBox = new TweetBox '#hashTweet'

  socket.on 'tweet', (data) ->
    json = JSON.parse data.message
    tweet = new Tweet(json.profile_image_url, json.screen_name, json.text, json.id_str)
    hashTweetBox.add(tweet)

class TweetBox
  constructor: (selector) ->
    @selector = selector
    @tweets = []
    @newTweets = 0
    @to = ''
    @from = ''
    @favicon= new Favico
      animation: 'slide'

    this.showMoreTweets()

    $("#{@selector} .new").on "click", =>
      this.showNewTweets()

  add: (tweet) ->
    @tweets.push tweet
    $("#{@selector} .stream").prepend tweet.content('newTweet')
    @newTweets++
    @favicon.badge(@newTweets)
    $("#hashTweetCount").text @newTweets
    this.updateNumber()

  showNewTweets: ->
    for t in @tweets
      if t.display
        continue
      t.display = true
    $(".tweet.newTweet").css('display', 'block').animate { opacity: 1 }, 1000
    @newTweets = 0
    @favicon.badge(0)
    $("#hashTweetCount").text 0
    this.updateNumber()

  showMoreTweets: =>
    $("#{@selector} .stream .more").css('display', 'none')
    $.ajax
      type: "GET"
      url: "/api/fetch_hash_tweets?from_id=#{@to}"
      success: (data) =>
        tweets = data.tweets
        str = ''
        for t, i in tweets
          tweet = new Tweet(t.profile_image_url, t.screen_name, t.text, t.id_str)
          str += tweet.content('moreTweet')
        $("#{@selector} .stream").append str
        $(".tweet.moreTweet").css('display', 'block').animate { opacity: 1 }, 1000
        this.setIds(data.from_id, data.to_id)

      error: (data, textStatus, errorThrown) ->

  updateNumber: ->
    $("#{@selector} .num").text @newTweets

  setIds: (from, to) ->
    @from = from
    @to = to

class Tweet
  constructor: (icon, username, text, id) ->
    @icon = "<a href='https://twitter.com/#{username}/status/#{id}' target='_blank'><img src='#{icon}' width='30' height='30' /></a>"
    @text = "<a href='https://twitter.com/#{username}/status/#{id}' target='_blank'><span class='twText' style='font-size:22px;'>#{text}</span></a>"
    @display = false

  content: (type) ->
    return "<li class='tweet #{type}' style='opacity: 0; display: none;'>#{@icon} 　#{@text}</li>"

showMessage = (selector, firstText, color, secondText) ->
  $("questionButton").attr('disabled', 'disabled')
  originalTextColor = $(selector).css('color')
  originalCountColor = $(".textCount").css('color')
  $(selector).css('background', color).css('color', '#fff').val(firstText).attr('disabled', 'disabled')
  $(".textCount").css('color', '#fff')
  setTimeout ->
    $(selector).css('background', '#fff').css('color', originalTextColor).val(secondText).removeAttr('disabled')
    $("questionButton").removeAttr('disabled')
    $(".textCount").css('color', originalCountColor)
  , 2000

