# This file is responsible for configuring your application
# and its dependencies with the aid of the Mix.Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.
use Mix.Config

# General application configuration
config :multiuser_elixir,
  ecto_repos: [MultiuserElixir.Repo]

# Configures the endpoint
config :multiuser_elixir, MultiuserElixir.Endpoint,
  url: [host: "localhost"],
  secret_key_base: "+sJr8KSijFujEwY5F9vr5b6a0kUFMZq5UP+y6dI+A+iLOXnyG4qUP+vJiTk2iacO",
  render_errors: [view: MultiuserElixir.ErrorView, accepts: ~w(html json)],
  pubsub: [name: MultiuserElixir.PubSub,
           adapter: Phoenix.PubSub.PG2]

# Configures Elixir's Logger
config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{Mix.env}.exs"
