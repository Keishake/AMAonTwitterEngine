role :web, "amaengine_admin"                          # Your HTTP server, Apache/etc
role :app, "amaengine_admin"                          # This may be the same as your `Web` server
role :db,  "amaengine_admin" # This is where Rails migrations will run

set :deploy_to, '/var/www/html/admin'
set :node_env, 'production'
set :app_command, "admin.js"
set :upstart_job_name, "asktokyo-admin"
