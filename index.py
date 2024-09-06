import json
from urllib.request import urlopen
from urllib.error import URLError, HTTPError

# API URLs (Make sure these are correct)
ergast_api_url = 'https://api.openf1.org/v1/drivers?driver_number=1&session_key=9158'
openf1_api_url = 'https://api.openf1.org/v1/Laps?meeting_key=1229&'

# Function to fetch data from a given API URL
def fetch_data(api_url):
    try:
        response = urlopen(api_url)
        data = response.read().decode('utf-8')

        # Print the raw response to check its content
        print(f"Raw response: {data}")

        # Try to parse it as JSON
        json_data = json.loads(data)
        return json_data

    except HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.reason}")
    except URLError as e:
        print(f"URL Error: {e.reason}")
    except json.JSONDecodeError as e:
        print(f"JSON Decode Error: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")
    return None

fetch_data(ergast_api_url)
