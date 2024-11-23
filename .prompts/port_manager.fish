#!/usr/bin/env fish

function get_process_info
    # Get process information including start time
    sudo lsof -i -P -n | grep LISTEN | grep -i tcp | \
    awk -v now=(date +%s) '
    BEGIN {
        printf "%-6s %-15s %-10s %-20s %-15s %s\n", "NUM", "PROCESS", "PID", "PORT", "UPTIME", "START TIME"
    }
    {
        cmd="ps -o lstart= -p " $2;
        cmd | getline start_time;
        close(cmd);
        cmd="date -d \""start_time"\" +%s";
        cmd | getline start_epoch;
        close(cmd);
        uptime = now - start_epoch;
        uptime_str = sprintf("%dd %dh %dm", uptime/86400, (uptime%86400)/3600, (uptime%3600)/60);
        printf "%-6d %-15s %-10s %-20s %-15s %s\n", NR, $1, $2, $9, uptime_str, start_time;
    }' | sort -k5 -r  # Sort by uptime in descending order
end

function show_menu
    echo "What would you like to do?"
    echo "1) List active ports"
    echo "2) Kill specific process by number"
    echo "3) Kill processes by uptime threshold"
    echo "4) Exit"
    read -P "Enter your choice (1-4): " choice

    switch $choice
        case 1
            clear
            echo "Current active localhost ports:"
            echo "------------------------------"
            set -g process_list (get_process_info)
            printf "%s\n" $process_list
            show_menu
            
        case 2
            if not set -q process_list
                echo "Please list active ports first (option 1)"
                show_menu
                return
            end
            
            read -P "Enter the process number to kill (or 'c' to cancel): " num
            if test "$num" = "c"
                show_menu
                return
            end
            
            set pid (echo $process_list | awk -v num=$num 'NR==(num+1) {print $3}')
            if test -n "$pid"
                read -P "Are you sure you want to kill process $pid? (y/n) " confirm
                if test "$confirm" = "y"
                    sudo kill -9 $pid
                    echo "Process $pid killed"
                    set -e process_list
                end
            else
                echo "Invalid process number"
            end
            show_menu
            
        case 3
            if not set -q process_list
                echo "Please list active ports first (option 1)"
                show_menu
                return
            end
            
            read -P "Kill processes older than how many hours? (or 'c' to cancel): " hours
            if test "$hours" = "c"
                show_menu
                return
            end
            
            set threshold (math $hours \* 3600)
            echo "The following processes will be killed:"
            echo $process_list | awk -v threshold=$threshold '
            NR > 1 { # Skip header
                split($5, uptime, "d ");
                days = uptime[1];
                split(uptime[2], hm, "h ");
                hours = hm[1];
                split(hm[2], m, "m");
                minutes = m[1];
                total_seconds = (days * 86400) + (hours * 3600) + (minutes * 60);
                if (total_seconds > threshold) {
                    print "PID:", $3, "Process:", $2, "Uptime:", $5;
                }
            }'
            
            read -P "Proceed with killing these processes? (y/n) " confirm
            if test "$confirm" = "y"
                echo $process_list | awk -v threshold=$threshold '
                NR > 1 {
                    split($5, uptime, "d ");
                    days = uptime[1];
                    split(uptime[2], hm, "h ");
                    hours = hm[1];
                    split(hm[2], m, "m");
                    minutes = m[1];
                    total_seconds = (days * 86400) + (hours * 3600) + (minutes * 60);
                    if (total_seconds > threshold) {
                        system("sudo kill -9 " $3);
                        print "Killed process", $3;
                    }
                }'
                set -e process_list
            end
            show_menu
            
        case 4
            echo "Exiting..."
            return
            
        case '*'
            echo "Invalid choice"
            show_menu
    end
end

# Start the program
clear
echo "Interactive Port Manager"
echo "----------------------"
show_menu
