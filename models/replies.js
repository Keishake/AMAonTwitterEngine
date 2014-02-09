var common = require('../common');
var config = common.config();
var mongoose = require('mongoose')
  , Schema   = mongoose.Schema;

var ReplySchema = new Schema({
  posts: Array,
  q_id_str: String,
  a_user_id_str: String,
  a_user_name: String,
  question: {
    screen_name: String,
    id_str: String,
    text: String,
    profile_image_url: String,
    created_at: Date
  },
  created_at: { type: Date, default: Date.now() },
  updated_at: { type: Date, default: Date.now() }
});
mongoose.model('Reply', ReplySchema);

module.exports = mongoose.model('Reply');

