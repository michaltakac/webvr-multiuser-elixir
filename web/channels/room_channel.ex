defmodule MultiuserElixir.RoomChannel do
  use MultiuserElixir.Web, :channel
  alias MultiuserElixir.Presence
  

  require Logger

  def join("room:lobby", _, socket) do
    send self(), :after_join
    {:ok, socket}
  end

  def join("room:" <> _room_id, _params, _socket) do
    {:error, %{reason: "unauthorized"}}
  end

  def handle_info(:after_join, socket) do
    {:ok, _} = Presence.track(socket, socket.assigns.user, %{
      online_at: :os.system_time(:milli_seconds)
    })
    push socket, "presence_state", Presence.list(socket)
    {:noreply, socket}
  end

  def handle_in("add_entity", %{"id" => id, "data" => data}, socket) do
    broadcast! socket, "add_entity", %{id: id, data: data}
    {:noreply, socket}
  end

  def handle_in("update_entity", %{"id" => id, "data" => data}, socket) do
    broadcast! socket, "update_entity", %{id: id, data: data}
    {:noreply, socket}
  end

  def handle_in("update_presence", %{"data" => data}, socket) do
    {:ok, _} = Presence.update(socket, socket.assigns.user, %{
      data: data
    })
    {:noreply, socket}
  end

  def leave(socket, topic) do
    Logger.debug "SOMEBODY LEAVING"
    broadcast socket, "user:left", %{ "content" => "somebody is leaving" }
    {:ok, socket}
  end
end