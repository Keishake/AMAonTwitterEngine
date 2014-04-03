require "capistrano/ext/multistage"
require "capistrano/node-deploy"
set :application, 'amaengine'
set :repository, 'git@github.com:Keishake/AMAonTwitterEngine.git'

# set :scm, :git # You can set :scm explicitly or Capistrano will make an intelligent guess based on known version control directory names
# Or: `accurev`, `bzr`, `cvs`, `darcs`, `git`, `mercurial`, `perforce`, `subversion` or `none`

set :deploy_to, '/var/www/html/amaengine'
set :user, 'ec2-user'
set :use_sudo, false

# Set app command to run (defaults to index.js, or your `main` file from `package.json`)
set :app_command, "app.js"

# Set additional environment variables for the app
set :app_environment, "PORT=3000"

# Set node binary to run (defaults to /usr/bin/node)
set :node_binary, "/usr/local/lib/nodebrew/current/bin/node"
set :npm_binary, "/usr/local/lib/nodebrew/current/bin/npm"

# Set the user to run node as (defaults to deploy)
set :node_user, "ec2-user"

set :keep_releases, 5
after :deploy, "deploy:cleanup"

# Set the name of the upstart command (defaults to #{application}-#{node_env})

# if you want to clean up old releases on each deploy uncomment this:
# after "deploy:restart", "deploy:cleanup"

# if you're still using the script/reaper helper you will need
# these http://github.com/rails/irs_process_scripts

# If you are using Passenger mod_rails uncomment this:
# namespace :deploy do
#   task :start do ; end
#   task :stop do ; end
#   task :restart, :roles => :app, :except => { :no_release => true } do
#     run "#{try_sudo} touch #{File.join(current_path,'tmp','restart.txt')}"
#   end
# end
