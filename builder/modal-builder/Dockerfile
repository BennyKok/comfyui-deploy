FROM python:3.10

WORKDIR /app

COPY ./requirements.txt ./

RUN pip install --no-cache-dir --upgrade -r ./requirements.txt

COPY ./src ./src

RUN mkdir builds

# CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "80", "--lifespan", "on"]
CMD ["python", "src/main.py"]
# If running behind a proxy like Nginx or Traefik add --proxy-headers
# CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "80", "--proxy-headers"]