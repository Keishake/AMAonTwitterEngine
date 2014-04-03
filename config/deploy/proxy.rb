role :web, "amaengine_server"                          # Your HTTP server, Apache/etc
role :app, "amaengine_server"                          # This may be the same as your `Web` server
role :db,  "amaengine_server" # This is where Rails migrations will run

set :deploy_to, '/var/www/html/proxy'
set :node_env, 'production'
set :app_command, "proxy.js"
set :upstart_job_name, "asktokyo-proxy"
set :app_environment, "PORT=3001"
