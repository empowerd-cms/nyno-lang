# singular step
nyno --workflow="{\"step\":\"ls\",\"next\":[1]}"

# multi step
nyno --workflow="[{\"step\":\"ls\",\"next\":[1]},{\"step\":\"ls\"}]"

# step with context
nyno --context='{"i":1}' --workflow="{\"step\":\"echo\",\"args\":[\"\${i}\"]}"

# multi step with context
nyno --context='{"i":1}' --workflow="[{\"step\":\"echo\",\"args\":[\"\${i}\"]}]"
