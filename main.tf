resource "aws_instance" "sneakers-api" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"
}

resource "aws_db_instance" "database" {
  allocated_storage = 20
  engine            = "postgres"
  instance_class    = "db.t3.micro"
  
  # Tham chiếu để tạo liên kết tự động
  vpc_security_group_ids = [aws_instance.sneakers-api.id]
}
