$ ->

  if from is "twitter"
    $("#questionText").css('background', '#b8f28c').css('color', '#fff').val('質問を受け付けました。')
    $(".textCount").css('visibility', 'hidden')
    setTimeout ->
      location.href = "/"
    , 2000
    return

  readDropbox()

  socket = io.connect "http://#{socketioUrl}"
  hashTweetBox = new TweetBox('#hashTweet')

  $.ajax
    type: "GET"
    url: "/api/answers"
    success: (data) =>
      tweets = data.tweets
      for t, i in tweets
        q = t.question
        question = new Tweet(q.profile_image_url, q.screen_name, q.text, 1, t.q_id_str, t.a_user_id_str)
        ansArr = t.answers
        answers = []
        for a, i in ansArr
          answers[i] = new Tweet(a.profile_image_url, a.screen_name, a.text, 2, t.q_id_str, t.a_user_id_str)
          
        qa = new QA(t.q_id_str, t.a_user_id_str, question, answers)
        qa.add(false)
        $(".qaTweet").css('display', 'block').animate { opacity: 1 }, 1000

    error: (data, textStatus, errorThrown) ->
      alert "通信に失敗しました。ページを再読み込みしてください。"

  questionBox = new QuestionBox '#questionText', '#questionButton'

  socket.on 'tweet', (data) ->
    json = JSON.parse data.message
    tweet = new Tweet(json.icon, json.username, json.text, 0, 'nothing', 'nothing')
    hashTweetBox.add(tweet)

  socket.on 'answer', (data) ->
    json = JSON.parse data.message
    q = json.question
    question = new Tweet(q.profile_image_url, q.screen_name, q.text, 1, json.q_id_str, json.a_user_id_str)
    ansArr = json.answers
    answers = []
    for a, i in ansArr
      answers[i] = new Tweet(a.profile_image_url, a.screen_name, a.text, 2, json.q_id_str, json.a_user_id_str)
    qa = new QA(json.q_id_str, json.a_user_id_str, question, answers)
    $(".id#{json.q_id_str}#{json.a_user_id_str}").remove()
    qa.add(true)
    $(".qaTweet").css('display', 'block').animate { opacity: 1 }, 1000

class QuestionBox
  constructor: (textSelector, buttonSelecotr) ->
    @textLength = $(textSelector).val().length
    $('.textCount').html(maxTweetLength - @textLength)
    $(textSelector).on 'keydown keyup keypress change', =>
      @textLength = $(textSelector).val().length
      $('.textCount').html(maxTweetLength - @textLength)

    $(buttonSelecotr).on 'click', =>
      if @textLength is 0
        showMessage textSelector, '質問を入力してください。', '#ef8f9c', ''
        return
      if @textLength > maxTweetLength
        currentVal = $(textSelector).val()
        showMessage textSelector, "#{maxTweetLength}文字以内で入力してください。", '#ef8f9c', currentVal
        return
      
      $(textSelector).css('color', '#ccc')
      $.ajax
        type: "POST"
        url: "/tweet"
        data: { text: $(textSelector).val() }
        success: (data) ->
          if data.stat isnt "success"
            showMessage textSelector, '同じ投稿は続けてできません。', '#ef8f9c', ''
            return
          showMessage textSelector, '質問を受け付けました。', '#b8f28c', ''
        error: (data, textStatus, errorThrown) ->
          $("#questionForm").submit()

    $(textSelector).on 'keypress', (ev) ->
      if (ev.which && ev.which is 13) || (ev.keyCode && ev.keyCode is 13) 
        return false
      else
        return true

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

    $("#{@selector} .more").on "click", =>
      this.showMoreTweets()

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
          tweet = new Tweet(t.profile_image_url, t.screen_name, t.text, 0)
          str += tweet.content('moreTweet')
        $("#{@selector} .stream").append str
        $(".tweet.moreTweet").css('display', 'block').animate { opacity: 1 }, 1000
        $("#{@selector} .stream").append '<button class="more">過去のツイートを読み込む</button>'
        $("#{@selector} .more").on "click", =>
          this.showMoreTweets()
        this.setIds(data.from_id, data.to_id)

      error: (data, textStatus, errorThrown) ->

  updateNumber: ->
    $("#{@selector} .num").text @newTweets

  setIds: (from, to) ->
    @from = from
    @to = to

class QA
  constructor: (qId, aUserId, question, answers) ->
    @qId = qId
    @aUserId = aUserId
    @question = question
    @answers = answers

  add: (prepend) ->
    str = ''
    str += @question.content('qaTweet')
    for a, i in @answers
      str += a.content('qaTweet')

    if @aUserId is candidates[0]
      id = '#uTweet'
      counter = '#uCount'
    else if @aUserId is candidates[1]
      id = '#mTweet'
      counter = '#mCount'
    else if @aUserId is candidates[2]
      id = '#iTweet'
      counter = '#iCount'
    else if @aUserId is candidates[3]
      id = '#hTweet'
      counter = '#hCount'
    str += "<div class='qaTweet' style='height: 2px; background: #04afe6; display: none; opacity: 0;'></div>"

    if prepend
      $("#{id} .qa").prepend str
      $("#mobile .qa").prepend str
      plus = 1
    else
      $("#{id} .qa").append str
      $("#mobile .qa").append str
      plus = @answers.length

    count = parseInt $(counter).text()
    newCount = count + plus
    $(counter).text newCount

    mCount = parseInt $('#mobileCount').text()
    newMCount = mCount + plus
    $('#mobileCount').text newMCount

class Tweet
  constructor: (icon, username, text, qa, id, id2) ->
    @qa = qa
    @id = id
    @id2 = id2
    if qa is 0
      @icon = "<a class='twIcon' href='https://twitter.com/#{username}' target='_blank'><img src='#{icon}' /></a>"
      @username = "<a class='twUsername' href='https://twitter.com/#{username}' target='_blank'>@#{username}</a>"
      @text = "<span class='twText'>" + text.replace(/(http:\/\/[\x21-\x7e]+)/gi, "<a href='$1' target='_blank'>$1</a>").replace(/\@([a-z0-9\_]+)(\.)?/gi, "<a href='https://twitter.com/$1' target='_blank'>@$1</a>").replace(/\#([ｦ-ﾟー゛゜々ヾヽぁ-ヶ一-龠ａ-ｚＡ-Ｚ０-９a-zA-Z0-9_]+)(\.)?/gi, "<a href='https://twitter.com/#$1' target='_blank'>#$1</a>") + "</span>"
      @display = false
      return

    @icon = "<a class='icon' href='https://twitter.com/#{username}' target='_blank'><img src='#{icon}' /></a>"
    @username = "<div class='name'><a href='https://twitter.com/#{username}' target='_blank'>@#{username}</a></div>"
    @text = "<p>" + text.replace(/(http:\/\/[\x21-\x7e]+)/gi, "<a href='$1' target='_blank'>$1</a>").replace(/\@([a-z0-9\_]+)(\.)?/gi, "<a href='https://twitter.com/$1' target='_blank'>@$1</a>").replace(/\#([ｦ-ﾟー゛゜々ヾヽぁ-ヶ一-龠ａ-ｚＡ-Ｚ０-９a-zA-Z0-9_]+)(\.)?/gi, "<a href='https://twitter.com/#$1' target='_blank'>#$1</a>") + "</p>"
    @display = false

  content: (type) ->
    if @qa is 0
      return "<li class='tweet #{type}' style='opacity: 0; display: none;'>#{@icon} #{@username}: #{@text}</li>"
    if @qa is 1
      return "<li class='q #{type} id#{@id}#{@id2}' style='opacity: 0; display: none;'><div class='user'><i class='q'>Q</i>#{@icon} #{@username}</div><div class='description'>#{@text}</div></li>"
    if @qa is 2
      return "<li class='a #{type} id#{@id}#{@id2}' style='opacity: 0; display: none;'><div class='user'><i class='a'>A</i>#{@icon} #{@username}</div><div class='description'>#{@text}</div></li>"

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

readDropbox = ->
  $.ajax
    type: "GET"
    url: "https://dl.dropboxusercontent.com/u/7963766/asktokyo/candidate.txt"
    success: (text) ->
      $('#candidateList').text(text)
    error: (data, textStatus, errorThrown) ->

  $.ajax
    type: "GET"
    url: "https://dl.dropboxusercontent.com/u/7963766/asktokyo/fixcandidate.txt"
    success: (text) ->
      $('#fixCandidateList').text(text)
    error: (data, textStatus, errorThrown) ->
