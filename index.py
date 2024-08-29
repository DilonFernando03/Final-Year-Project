import requests 

car_data = requests.get("https://api.openf1.org/v1/car_data?driver_number=55&session_key=9159&speed>=315").text

print(car_data)