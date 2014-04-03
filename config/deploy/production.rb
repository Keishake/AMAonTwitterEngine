role :web, "amaengine_server"                          # Your HTTP server, Apache/etc
role :app, "amaengine_server"                          # This may be the same as your `Web` server
role :db,  "amaengine_server"

set :deploy_to, '/var/www/html/amaengine'
set :node_env, 'production'
set :app_environment, "PORT=3000"
