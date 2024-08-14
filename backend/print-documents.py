from flask import Flask, request
from flask_cors import CORS
from zebra import Zebra
import cups
import os

app = Flask(__name__)
CORS(app)
z = Zebra()
z.setqueue('ZTC-ZT230-200dpi-ZPL')
print('Starting ssh')
command_string = 'autossh -M 20000 -R 4000:localhost:8000 -i "brandtw_monnit_prod.pem" ubuntu@ec2-3-134-9-110.us-east-2.compute.amazonaws.com'
os.system(f"gnome-terminal -e '{command_string}'")
print('ssh successful')

@app.route('/print-label/', methods=['GET', 'POST'])
def print_labels():
    dueDate = request.args.get('due_date')
    calibrationDate = request.args.get('calibration_date')
    certificateNumber = request.args.get('certificate_number')
    label = f'^XA~TA000~JSN^LT0^MNW^MTT^PON^PMN^LH0,0^JMA^PR2,2~SD30^JUS^LRN^CI27^PA0,1,1,0^XZ^XA^MMT^PW203^LL102^LS0^FO70,20^AJ,15^FD{calibrationDate}^FS^FO70,40^AJ,15^FD{dueDate}^FS^FO80,60^AJ,15^FD{certificateNumber}^FS^FO20,16^GFA,93,184,8,:Z64:eJxjYCAWsIFJ9gMQWh5KWzhAaAPmYwkgOoH9GYRmSQOLJzA/Y4CKg+kCHoi4hQ+Elj8PUc/fnpZAtFOAAACreg35:8B4E^FO20,53^GFA,137,184,8,:Z64:eJxjYCANsB9g4GFQYWCQB9E5DAwWDkDag4HBgPnYfcZ/BxgS2J/fZ/AA0jzmPAw3GBgS+L/xMEyA0Mx/GBgKeNjAfAs/NR7GDUBzjj/jZ1Q4wMDffIydgeEA0e4AANmjF0E=:8920^FO20,34^GFA,89,184,8,:Z64:eJxjYCAN1MPoBgideABCJzyTqAAxE9Ik/kBoyTYGCP0PhT4mCdaZeNzyCNic9h9g9XXMNyoOkOAOAGJoFx4=:2C00^FO14,73^GFA,305,504,24,:Z64:eJzFziELwkAUB/AngkbrDmGCwey4oCueza8hGuxbFaYIW9kHuDDwM9iMs7hysGw7OdBikQtDOME3FCwaxX948P+F9x7Af1MlCxxfXH3wCrp890GjGe3UVSmyNTeNJbXtXh8gaK3zs9aFJuZ+12ydSxYwAzBxEjGiUZsSIWPlJmLo+a4AmDOehzSsahJLoxyeL8ZTJwZgjGcnGtbRj6Vn8un1rpWi1yh6jJ6+fOpYYkajDu5Hd7kYe37pQYvjP6tCH8zRaDx2YkHpg4aV7dRSbQ5befGx7G279F/nAdOvbUA=:C8CB^PQ1,0,1,Y^XZ'
    
    z.output(label)
    return 'Printed label successfully'

@app.route('/print-pdf/', methods=['GET', 'POST'])
def test():
    data = request.data
    with open('recentPdf.pdf', 'wb') as file:
        file.write(data)

    conn = cups.Connection()
    printerName = 'HP-ColorLaserJet-M255-M256'
    job_id = conn.createJob(printerName, 'Print PDF Job', {})
    conn.printFile(printerName, 'recentPdf.pdf', 'recentPdf.pdf', {})
    conn.cancelJob(job_id)
    return 'Printed PDF successfully'

if __name__ == '__main__':
    app.run(host='localhost', port=8000)