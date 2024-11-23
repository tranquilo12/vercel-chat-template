#!/usr/bin/env fish

function show_local_ports
    echo "Active localhost ports:"
    echo "----------------------"
    sudo lsof -i -P -n | grep LISTEN | grep -i tcp | awk '{printf "%-15s %-10s %s\n", $1, $2, $9}' | sort -u
end

# Run the function
show_local_ports
